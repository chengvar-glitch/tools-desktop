import { useMemo, useState } from 'react'
import {
  Button,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Textarea,
  tokens,
  makeStyles
} from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { useToolStyles } from '@/components/toolStyles'
import {
  processLines,
  type DedupeMode,
  type ListOptions,
  type SortMode,
  type SortOrder
} from '@/lib/lines'

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
  output: {
    flex: 1,
    minHeight: '160px'
  }
})

const ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'none', label: '保持原序' },
  { value: 'asc', label: '升序' },
  { value: 'desc', label: '降序' }
]

const MODE_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'natural', label: '智能（数字感知）' },
  { value: 'string', label: '按字符编码' },
  { value: 'numeric', label: '按数值' },
  { value: 'length', label: '按长度' }
]

const DEDUPE_OPTIONS: { value: DedupeMode; label: string }[] = [
  { value: 'none', label: '不去重' },
  { value: 'first', label: '去重·保留首次' },
  { value: 'last', label: '去重·保留末次' }
]

function SortTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [input, setInput] = useState('')
  const [order, setOrder] = useState<SortOrder>('asc')
  const [mode, setMode] = useState<SortMode>('natural')
  const [dedupe, setDedupe] = useState<DedupeMode>('first')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true)
  const [dropEmpty, setDropEmpty] = useState(true)

  const options = useMemo<ListOptions>(
    () => ({ order, mode, dedupe, ignoreCase, ignoreWhitespace, dropEmpty }),
    [order, mode, dedupe, ignoreCase, ignoreWhitespace, dropEmpty]
  )
  const result = useMemo(() => processLines(input, options), [input, options])

  const output = result.lines.join('\n')
  const duplicates = result.duplicates.join('\n')
  const removed = result.removedDuplicates.join('\n')

  return (
    <div className={shared.root}>
      <div className={styles.options}>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            排序
          </Text>
          <RadioGroup
            layout="horizontal"
            value={order}
            onChange={(_, data) => setOrder(data.value as SortOrder)}
          >
            {ORDER_OPTIONS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            比较
          </Text>
          <RadioGroup
            layout="horizontal"
            value={mode}
            onChange={(_, data) => setMode(data.value as SortMode)}
          >
            {MODE_OPTIONS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            去重
          </Text>
          <RadioGroup
            layout="horizontal"
            value={dedupe}
            onChange={(_, data) => setDedupe(data.value as DedupeMode)}
          >
            {DEDUPE_OPTIONS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Switch
            label="忽略大小写"
            checked={ignoreCase}
            onChange={(_, data) => setIgnoreCase(data.checked)}
          />
          <Switch
            label="去除行首尾空白"
            checked={ignoreWhitespace}
            onChange={(_, data) => setIgnoreWhitespace(data.checked)}
          />
          <Switch
            label="移除空行"
            checked={dropEmpty}
            onChange={(_, data) => setDropEmpty(data.checked)}
          />
        </div>
      </div>

      <div className={shared.actions}>
        <CopyButton
          label="复制结果"
          text={output}
          appearance="primary"
          tooltip="复制排序去重后的完整结果"
        />
        <CopyButton
          label="复制重复项"
          text={duplicates}
          tooltip="复制出现过 2 次以上的行（去重后）"
        />
        <CopyButton label="复制被去掉的重复行" text={removed} tooltip="复制因去重被移除的那些行" />
        <div className={shared.spacer} />
        <Text size={200} className={shared.stats}>
          输入 {result.inputCount} 行 · 输出 {result.lines.length} 行 · 重复{' '}
          {result.duplicateGroups} 组 · 去重移除 {result.removedDuplicates.length} 行
        </Text>
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
            输入（每行一条）
          </Text>
          <Textarea
            className={shared.fill}
            textarea={{ className: shared.monoFill }}
            placeholder={'每行一条内容，例如：\nitem-10\nitem-2\nitem-2'}
            value={input}
            onChange={(_, data) => setInput(data.value)}
          />
        </div>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            结果
          </Text>
          <Textarea
            className={styles.output}
            textarea={{ readOnly: true, className: shared.monoFill }}
            value={output}
            placeholder="结果会实时显示在这里"
          />
        </div>
      </div>
    </div>
  )
}

export default SortTool
