import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Switch,
  Text,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components'
import { ArrowSwapRegular, DismissRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { MONO_FONT, useToolStyles } from '@/components/toolStyles'
import {
  diffRows,
  diffStats,
  formatAddedText,
  formatMarkedDiff,
  formatPairs,
  formatRemovedText,
  formatSummary,
  hasDifference,
  type CharRange
} from '@/lib/diff'

const ADD_BG = '#e6ffec'
const REMOVE_BG = '#ffebe9'
const MODIFY_BG = '#fff8c5'
const ADD_MARK = '#abf2bc'
const REMOVE_MARK = '#ffc1c0'

// 行数过多时只渲染前面一部分，避免一次性插入几十万个 DOM 节点。
const MAX_RENDER_ROWS = 1500

const useStyles = makeStyles({
  table: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr) 56px minmax(0, 1fr)',
    minWidth: '100%',
    fontFamily: MONO_FONT,
    fontSize: '12px',
    lineHeight: '20px',
    userSelect: 'text'
  },
  headGutter: {
    backgroundColor: tokens.colorNeutralBackground2,
    position: 'sticky',
    top: 0,
    zIndex: 1
  },
  head: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '4px 8px',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  gutter: {
    padding: '0 8px',
    textAlign: 'right',
    color: tokens.colorNeutralForeground4,
    backgroundColor: tokens.colorNeutralBackground2,
    userSelect: 'none'
  },
  gutterLeft: {
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`
  },
  gutterRight: {
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`
  },
  cell: {
    padding: '0 8px',
    whiteSpace: 'pre',
    minHeight: '20px'
  },
  plain: {},
  added: {
    backgroundColor: ADD_BG
  },
  removed: {
    backgroundColor: REMOVE_BG
  },
  changed: {
    backgroundColor: MODIFY_BG
  },
  markAdded: {
    backgroundColor: ADD_MARK,
    borderRadius: '2px'
  },
  markRemoved: {
    backgroundColor: REMOVE_MARK,
    borderRadius: '2px'
  }
})

function renderSegments(text: string, marks: CharRange[], markClass: string): React.JSX.Element {
  if (marks.length === 0) return <>{text}</>

  const nodes: React.JSX.Element[] = []
  let cursor = 0
  marks.forEach((mark, index) => {
    if (mark.start > cursor) {
      nodes.push(<span key={`text-${index}`}>{text.slice(cursor, mark.start)}</span>)
    }
    nodes.push(
      <span key={`mark-${index}`} className={markClass}>
        {text.slice(mark.start, mark.end)}
      </span>
    )
    cursor = mark.end
  })
  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>)

  return <>{nodes}</>
}

function DiffTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)

  const options = useMemo(() => ({ ignoreCase, ignoreWhitespace }), [ignoreCase, ignoreWhitespace])
  const rows = useMemo(() => diffRows(left, right, options), [left, right, options])
  const stats = useMemo(() => diffStats(rows), [rows])
  const visibleRows = useMemo(() => rows.slice(0, MAX_RENDER_ROWS), [rows])

  const addedText = useMemo(() => formatAddedText(rows), [rows])
  const removedText = useMemo(() => formatRemovedText(rows), [rows])
  const markedText = useMemo(() => formatMarkedDiff(rows), [rows])
  const pairsText = useMemo(() => formatPairs(rows), [rows])
  const summaryText = useMemo(() => formatSummary(rows), [rows])

  const bothEmpty = left === '' && right === ''
  const identical = !bothEmpty && !hasDifference(rows)

  return (
    <div className={shared.root}>
      <div className={shared.panes}>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            原文（左）
          </Text>
          <Textarea
            className={shared.editor}
            resize="vertical"
            placeholder="粘贴旧内容…"
            value={left}
            onChange={(_, data) => setLeft(data.value)}
          />
        </div>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            新版（右）
          </Text>
          <Textarea
            className={shared.editor}
            resize="vertical"
            placeholder="粘贴新内容…"
            value={right}
            onChange={(_, data) => setRight(data.value)}
          />
        </div>
      </div>

      <div className={shared.toolbar}>
        <Switch
          label="忽略大小写"
          checked={ignoreCase}
          onChange={(_, data) => setIgnoreCase(data.checked)}
        />
        <Switch
          label="忽略空白差异"
          checked={ignoreWhitespace}
          onChange={(_, data) => setIgnoreWhitespace(data.checked)}
        />
        <div className={shared.spacer} />
        <Badge appearance="tint" color="success">
          新增 {stats.added}
        </Badge>
        <Badge appearance="tint" color="danger">
          删除 {stats.removed}
        </Badge>
        <Badge appearance="tint" color="warning">
          修改 {stats.modified}
        </Badge>
        <Button
          appearance="subtle"
          icon={<ArrowSwapRegular />}
          onClick={() => {
            setLeft(right)
            setRight(left)
          }}
        >
          交换左右
        </Button>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => {
            setLeft('')
            setRight('')
          }}
        >
          清空
        </Button>
      </div>

      <div className={shared.actions}>
        <CopyButton label="复制新增行" text={addedText} tooltip="复制右侧新增/修改后的行" />
        <CopyButton label="复制删除行" text={removedText} tooltip="复制左侧被删除/修改前的行" />
        <CopyButton label="复制差异" text={markedText} tooltip="复制带 - / + 前缀的差异内容" />
        <CopyButton label="复制变更对照" text={pairsText} tooltip="复制「旧 => 新」逐行对照" />
        <CopyButton label="复制摘要" text={summaryText} tooltip="复制新增/删除/修改行数统计" />
        <div className={shared.spacer} />
        <Text size={200} className={shared.stats}>
          共 {rows.length} 行
        </Text>
      </div>

      {identical && (
        <MessageBar intent="success">
          <MessageBarBody>两份内容完全一致。</MessageBarBody>
        </MessageBar>
      )}

      <div className={shared.panel}>
        {bothEmpty ? (
          <Text size={200} className={shared.hint}>
            在上方两个输入框分别粘贴文本，差异会按行分栏显示在这里。
          </Text>
        ) : (
          <div className={styles.table}>
            <span className={mergeClasses(styles.headGutter, styles.gutter, styles.gutterLeft)} />
            <span className={styles.head} style={{ gridColumn: '2 / 3' }}>
              原文（左）
            </span>
            <span className={mergeClasses(styles.headGutter, styles.gutter, styles.gutterRight)} />
            <span className={styles.head} style={{ gridColumn: '4 / 5' }}>
              新版（右）
            </span>
            {visibleRows.map((row, index) => {
              const leftCell = mergeClasses(
                styles.cell,
                row.kind === 'remove'
                  ? styles.removed
                  : row.kind === 'modify'
                    ? styles.changed
                    : styles.plain
              )
              const rightCell = mergeClasses(
                styles.cell,
                row.kind === 'add'
                  ? styles.added
                  : row.kind === 'modify'
                    ? styles.changed
                    : styles.plain
              )
              return (
                <div key={index} style={{ display: 'contents' }}>
                  <span className={mergeClasses(styles.gutter, styles.gutterLeft)}>
                    {row.leftNo ?? ''}
                  </span>
                  <span className={leftCell}>
                    {renderSegments(row.leftText, row.leftMarks, styles.markRemoved)}
                  </span>
                  <span className={mergeClasses(styles.gutter, styles.gutterRight)}>
                    {row.rightNo ?? ''}
                  </span>
                  <span className={rightCell}>
                    {renderSegments(row.rightText, row.rightMarks, styles.markAdded)}
                  </span>
                </div>
              )
            })}
            {rows.length > visibleRows.length && (
              <Text size={200} className={shared.note} style={{ gridColumn: '1 / -1' }}>
                仅显示前 {visibleRows.length} 行（共 {rows.length} 行），复制按钮仍会处理全部内容。
              </Text>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DiffTool
