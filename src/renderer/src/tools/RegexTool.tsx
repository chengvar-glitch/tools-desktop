import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Input,
  MessageBar,
  MessageBarBody,
  Switch,
  Text,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { MONO_FONT, useToolStyles } from '@/components/toolStyles'
import {
  DEFAULT_OPTIONS,
  MAX_MATCHES,
  flagString,
  formatMatchList,
  formatMatchValues,
  highlightMatches,
  replaceWithRegex,
  runRegex,
  type RegexOptions
} from '@/lib/regex'

const MATCH_BG = '#fff3b0'

// 匹配列表最多渲染这么多行，几千条匹配全铺出来会卡
const MAX_LIST_ROWS = 200

const useStyles = makeStyles({
  pattern: {
    flex: 1,
    minWidth: '240px'
  },
  patternBox: {
    fontFamily: MONO_FONT,
    fontSize: '12px'
  },
  replacement: {
    flex: 1,
    minWidth: '200px'
  },
  highlight: {
    padding: '8px 10px',
    fontFamily: MONO_FONT,
    fontSize: '12px',
    lineHeight: '20px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    userSelect: 'text'
  },
  mark: {
    backgroundColor: MATCH_BG,
    borderRadius: '2px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    fontFamily: MONO_FONT,
    fontSize: '12px',
    lineHeight: '18px',
    userSelect: 'text'
  },
  row: {
    display: 'flex',
    gap: '8px',
    padding: '2px 10px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  rowNo: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground4
  },
  rowValue: {
    color: tokens.colorNeutralForeground1
  },
  rowGroup: {
    color: tokens.colorNeutralForeground3
  }
})

const FLAG_OPTIONS: { key: keyof RegexOptions; label: string }[] = [
  { key: 'ignoreCase', label: '忽略大小写 i' },
  { key: 'multiline', label: '多行 ^$ m' },
  { key: 'dotAll', label: '. 匹配换行 s' },
  { key: 'unicode', label: 'Unicode u' }
]

function RegexTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [pattern, setPattern] = useState('')
  const [input, setInput] = useState('')
  const [replacement, setReplacement] = useState('')
  const [options, setOptions] = useState<RegexOptions>(DEFAULT_OPTIONS)

  const run = useMemo(() => runRegex(pattern, input, options), [pattern, input, options])
  const replaced = useMemo(
    () => replaceWithRegex(pattern, input, replacement, options),
    [pattern, input, replacement, options]
  )
  const segments = useMemo(() => highlightMatches(input, run.matches), [input, run.matches])
  const matchValues = useMemo(() => formatMatchValues(run.matches), [run.matches])
  const matchList = useMemo(() => formatMatchList(input, run.matches), [input, run.matches])
  const visibleMatches = run.matches.slice(0, MAX_LIST_ROWS)

  const error = run.error
  const flags = flagString(options)
  const active = pattern !== '' && error === null

  return (
    <div className={shared.root}>
      <div className={shared.toolbar}>
        <Input
          className={styles.pattern}
          contentBefore={<span className={styles.patternBox}>/</span>}
          contentAfter={<span className={styles.patternBox}>/g{flags}</span>}
          placeholder="正则表达式，如 \d{4}-\d{2}-\d{2} 或 (?<name>[\w.-]+)@([\w.]+)"
          value={pattern}
          onChange={(_, data) => setPattern(data.value)}
        />
        {FLAG_OPTIONS.map((flag) => (
          <Switch
            key={flag.key}
            label={flag.label}
            checked={options[flag.key]}
            onChange={(_, data) => setOptions((prev) => ({ ...prev, [flag.key]: data.checked }))}
          />
        ))}
      </div>

      <div className={shared.toolbar}>
        <Input
          className={styles.replacement}
          contentBefore={
            <Text size={200} className={shared.stats}>
              替换为
            </Text>
          }
          placeholder="替换串，可用 $1 / $<name> / $& ，留空即删除匹配"
          value={replacement}
          onChange={(_, data) => setReplacement(data.value)}
        />
        <Text size={200} className={shared.stats}>
          支持 $1 分组、$&lt;name&gt; 命名分组、$&amp; 整个匹配
        </Text>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={shared.actions}>
        <CopyButton
          label="复制匹配项"
          text={matchValues}
          appearance="primary"
          tooltip="按行复制每个匹配到的内容"
        />
        <CopyButton label="复制匹配列表" text={matchList} tooltip="复制带位置与分组的逐条明细" />
        <CopyButton label="复制替换结果" text={replaced.text} tooltip="复制替换后的全文" />
        <div className={shared.spacer} />
        <Badge appearance="tint" color={active && run.matches.length > 0 ? 'brand' : 'informative'}>
          匹配 {run.matches.length}
          {run.truncated ? '+' : ''} 处
        </Badge>
        <Text size={200} className={shared.stats}>
          {input.length} 字符 · {input === '' ? 0 : input.split('\n').length} 行
        </Text>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => {
            setPattern('')
            setInput('')
            setReplacement('')
          }}
          disabled={pattern === '' && input === '' && replacement === ''}
        >
          清空
        </Button>
      </div>

      <div className={shared.panes}>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            测试文本
          </Text>
          <Textarea
            className={shared.fill}
            textarea={{ className: shared.monoFill }}
            placeholder={
              '粘贴待匹配的文本…\n例如：\n张三 zhangsan@example.com 2024-01-08\n李四 lisi@test.org 2024-02-19'
            }
            value={input}
            onChange={(_, data) => setInput(data.value)}
          />
        </div>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            替换结果（共替换 {active ? run.matches.length : 0} 处）
          </Text>
          <Textarea
            className={shared.fill}
            textarea={{ readOnly: true, className: shared.monoFill }}
            value={replaced.text}
            placeholder="替换结果会实时显示在这里"
          />
        </div>
      </div>

      <div className={shared.pane}>
        <Text size={200} className={shared.paneTitle}>
          匹配高亮
        </Text>
        <div className={mergeClasses(shared.panel, styles.highlight)}>
          {input === '' ? (
            <Text size={200} className={shared.stats}>
              在上方输入正则与测试文本，命中位置会在这里高亮。
            </Text>
          ) : (
            segments.map((segment, index) =>
              segment.matched ? (
                <span key={index} className={styles.mark}>
                  {segment.text}
                </span>
              ) : (
                <span key={index}>{segment.text}</span>
              )
            )
          )}
        </div>
      </div>

      <div className={shared.pane}>
        <Text size={200} className={shared.paneTitle}>
          匹配明细
        </Text>
        <div className={shared.panel}>
          {run.matches.length === 0 ? (
            <Text size={200} className={shared.hint}>
              {active ? '没有匹配到内容。' : '还没有匹配结果。'}
            </Text>
          ) : (
            <div className={styles.list}>
              {visibleMatches.map((match) => (
                <div key={match.no} className={styles.row}>
                  <span className={styles.rowNo}>#{match.no}</span>
                  <span className={styles.rowValue}>{match.value || '(零宽匹配)'}</span>
                  {match.groups.map((group) => (
                    <span key={group.label} className={styles.rowGroup}>
                      ${group.label}={group.value ?? '—'}
                    </span>
                  ))}
                  {Object.entries(match.named).map(([name, value]) => (
                    <span key={name} className={styles.rowGroup}>
                      &lt;{name}&gt;={value}
                    </span>
                  ))}
                </div>
              ))}
              {run.matches.length > visibleMatches.length && (
                <Text size={200} className={shared.note}>
                  仅显示前 {visibleMatches.length} 条（共 {run.matches.length}
                  {run.truncated ? `+，已在 ${MAX_MATCHES} 处截断` : ''}{' '}
                  条），复制按钮仍会输出全部匹配。
                </Text>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RegexTool
