import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Textarea,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import { ArrowSyncRegular, DismissRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { useToolStyles } from '@/components/toolStyles'
import {
  escapeJsonString,
  formatBytes,
  formatJson,
  jsonStats,
  minifyJson,
  parseJson,
  parseYaml,
  sortKeysDeep,
  toTypeScript,
  toYaml,
  unescapeJsonString,
  type Indent,
  type JsonError,
  type JsonValue
} from '@/lib/json'

type JsonOp = 'format' | 'minify' | 'escape' | 'unescape' | 'yaml' | 'fromYaml' | 'typescript'

const OPS: { value: JsonOp; label: string }[] = [
  { value: 'format', label: '格式化' },
  { value: 'minify', label: '压缩' },
  { value: 'escape', label: '转义字符串' },
  { value: 'unescape', label: '反转义' },
  { value: 'yaml', label: '转 YAML' },
  { value: 'fromYaml', label: 'YAML 转 JSON' },
  { value: 'typescript', label: '转 TS 接口' }
]

const INDENTS: { value: Indent; label: string }[] = [
  { value: '2', label: '2 空格' },
  { value: '4', label: '4 空格' },
  { value: 'tab', label: 'Tab' }
]

const useStyles = makeStyles({
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  optionLabel: {
    color: tokens.colorNeutralForeground3,
    minWidth: '56px'
  },
  rootName: {
    maxWidth: '200px'
  },
  output: {
    flex: 1,
    minHeight: '200px'
  }
})

interface Computed {
  text: string
  error: JsonError | null
  value: JsonValue | null
}

function compute(
  input: string,
  op: JsonOp,
  indent: Indent,
  lenient: boolean,
  sortKeys: boolean,
  rootName: string
): Computed {
  if (input.trim() === '') return { text: '', error: null, value: null }

  if (op === 'escape') {
    return { text: escapeJsonString(input.trim()), error: null, value: null }
  }

  if (op === 'unescape') {
    const result = unescapeJsonString(input)
    return result.ok
      ? { text: result.value, error: null, value: null }
      : { text: '', error: result.error, value: null }
  }

  const parsed = op === 'fromYaml' ? parseYaml(input) : parseJson(input, lenient)
  if (!parsed.ok) return { text: '', error: parsed.error, value: null }

  const value = sortKeys ? sortKeysDeep(parsed.value) : parsed.value
  switch (op) {
    case 'minify':
      return { text: minifyJson(value), error: null, value }
    case 'yaml':
      return { text: toYaml(value), error: null, value }
    case 'typescript':
      return {
        text: toTypeScript(value, rootName.trim() === '' ? 'Root' : rootName.trim()),
        error: null,
        value
      }
    case 'fromYaml':
    case 'format':
    default:
      return { text: formatJson(value, indent), error: null, value }
  }
}

function JsonTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [input, setInput] = useState('')
  const [op, setOp] = useState<JsonOp>('format')
  const [indent, setIndent] = useState<Indent>('2')
  const [lenient, setLenient] = useState(false)
  const [sortKeys, setSortKeys] = useState(false)
  const [rootName, setRootName] = useState('Root')

  const computed = useMemo(
    () => compute(input, op, indent, lenient, sortKeys, rootName),
    [input, op, indent, lenient, sortKeys, rootName]
  )

  const stats = useMemo(
    () => (computed.value === null ? null : jsonStats(computed.value)),
    [computed.value]
  )
  const copies = useMemo(() => {
    if (computed.value === null) {
      return { escaped: escapeJsonString(input.trim()), minified: '', yaml: '', typescript: '' }
    }
    return {
      escaped: escapeJsonString(input.trim()),
      minified: minifyJson(computed.value),
      yaml: toYaml(computed.value),
      typescript: toTypeScript(computed.value, rootName.trim() === '' ? 'Root' : rootName.trim())
    }
  }, [computed.value, input, rootName])

  return (
    <div className={shared.root}>
      <div className={styles.options}>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            操作
          </Text>
          <RadioGroup
            layout="horizontal"
            value={op}
            onChange={(_, data) => setOp(data.value as JsonOp)}
          >
            {OPS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            缩进
          </Text>
          <RadioGroup
            layout="horizontal"
            value={indent}
            onChange={(_, data) => setIndent(data.value as Indent)}
          >
            {INDENTS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
          <Switch
            label="宽松模式（注释 / 尾逗号 / 单引号）"
            checked={lenient}
            onChange={(_, data) => setLenient(data.checked)}
          />
          <Switch
            label="键名排序"
            checked={sortKeys}
            onChange={(_, data) => setSortKeys(data.checked)}
          />
          <Field label="TS 根名称" className={styles.rootName}>
            <Input value={rootName} onChange={(_, data) => setRootName(data.value)} />
          </Field>
        </div>
      </div>

      {computed.error ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {computed.error.line !== null
              ? `第 ${computed.error.line} 行第 ${computed.error.column} 列：`
              : ''}
            {computed.error.hint ?? '解析失败'}
            <br />
            <Text size={200}>{computed.error.message}</Text>
          </MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.optionRow}>
          {stats ? (
            <>
              <Badge appearance="tint">{stats.type}</Badge>
              <Badge appearance="tint">键 {stats.keys}</Badge>
              <Badge appearance="tint">深度 {stats.depth}</Badge>
              <Badge appearance="tint">{formatBytes(stats.bytes)}</Badge>
              <Badge appearance="tint" color={lenient ? 'warning' : 'success'}>
                {lenient ? 'JSON5 宽松解析' : '标准 JSON'}
              </Badge>
            </>
          ) : (
            <Text size={200} className={shared.stats}>
              粘贴 JSON 后会自动解析，左侧输入右侧出结果。
            </Text>
          )}
        </div>
      )}

      <div className={shared.actions}>
        <CopyButton
          label="复制结果"
          text={computed.text}
          appearance="primary"
          tooltip="复制当前操作的结果"
        />
        <CopyButton label="复制压缩" text={copies.minified} tooltip="复制压缩成一行后的 JSON" />
        <CopyButton label="复制为字符串" text={copies.escaped} tooltip="复制转义后的 JSON 字符串" />
        <CopyButton label="复制 YAML" text={copies.yaml} tooltip="复制转换后的 YAML" />
        <CopyButton
          label="复制 TS 接口"
          text={copies.typescript}
          tooltip="复制生成的 TypeScript 接口"
        />
        <div className={shared.spacer} />
        <Button
          appearance="subtle"
          icon={<ArrowSyncRegular />}
          onClick={() => {
            setInput(computed.text)
            setOp('format')
          }}
          disabled={computed.text === ''}
        >
          结果转输入
        </Button>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => setInput('')}
          disabled={input === ''}
        >
          清空
        </Button>
      </div>

      <div className={shared.panes}>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            {op === 'fromYaml' ? 'YAML 输入' : 'JSON 输入'}
          </Text>
          <Textarea
            className={shared.fill}
            textarea={{ className: shared.monoFill }}
            placeholder={'粘贴 JSON，例如：\n{"name": "张三", "tags": ["a", "b"]}'}
            value={input}
            onChange={(_, data) => setInput(data.value)}
          />
        </div>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            输出
          </Text>
          <Textarea
            className={styles.output}
            textarea={{ readOnly: true, className: shared.monoFill }}
            value={computed.text}
            placeholder="结果会实时显示在这里"
          />
        </div>
      </div>
    </div>
  )
}

export default JsonTool
