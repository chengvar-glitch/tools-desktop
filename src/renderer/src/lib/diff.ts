import { splitLines } from './text'

export type DiffOp =
  | { type: 'equal'; aIndex: number; bIndex: number }
  | { type: 'delete'; aIndex: number }
  | { type: 'insert'; bIndex: number }

export interface CharRange {
  start: number
  end: number
}

export type DiffRowKind = 'equal' | 'add' | 'remove' | 'modify'

export interface DiffRow {
  kind: DiffRowKind
  leftNo: number | null
  rightNo: number | null
  leftText: string
  rightText: string
  leftMarks: CharRange[]
  rightMarks: CharRange[]
}

export interface DiffOptions {
  ignoreCase: boolean
  ignoreWhitespace: boolean
}

export interface DiffStats {
  added: number
  removed: number
  modified: number
  unchanged: number
}

// 回溯需要保存每一层的 V 快照，深度上限用来把内存限制在几十 MB 以内。
// 超过上限时退化为「中间整块替换」，前缀/后缀的相同行仍然会被保留。
const MAX_EDIT_DEPTH = 1500

// 单行字符级高亮的长度上限，超长行只做整行标记。
const MAX_INLINE_LENGTH = 2000

function normalizeLine(line: string, options: DiffOptions): string {
  let value = line
  if (options.ignoreWhitespace) value = value.trim().replace(/\s+/g, ' ')
  if (options.ignoreCase) value = value.toLowerCase()
  return value
}

function myers(a: string[], b: string[]): DiffOp[] | null {
  const n = a.length
  const m = b.length
  const limit = Math.min(n + m, MAX_EDIT_DEPTH)
  const offset = limit + 1
  const v = new Int32Array(2 * limit + 3)
  const trace: Int32Array[] = []

  for (let d = 0; d <= limit; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]
      } else {
        x = v[offset + k - 1] + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) {
        trace.push(v.slice())
        return backtrack(trace, d, offset, n, m)
      }
    }
    trace.push(v.slice())
  }

  return null
}

function backtrack(
  trace: Int32Array[],
  depth: number,
  offset: number,
  n: number,
  m: number
): DiffOp[] {
  const ops: DiffOp[] = []
  let x = n
  let y = m

  for (let d = depth; d > 0; d--) {
    const prev = trace[d - 1]
    const k = x - y
    const goesDown = k === -d || (k !== d && prev[offset + k - 1] < prev[offset + k + 1])
    const prevK = goesDown ? k + 1 : k - 1
    const prevX = prev[offset + prevK]
    const prevY = prevX - prevK
    const midX = goesDown ? prevX : prevX + 1

    while (x > midX && y > midX - k) {
      ops.push({ type: 'equal', aIndex: x - 1, bIndex: y - 1 })
      x--
      y--
    }
    if (goesDown) {
      ops.push({ type: 'insert', bIndex: y - 1 })
    } else {
      ops.push({ type: 'delete', aIndex: x - 1 })
    }
    x = prevX
    y = prevY
  }

  while (x > 0 && y > 0) {
    ops.push({ type: 'equal', aIndex: x - 1, bIndex: y - 1 })
    x--
    y--
  }

  return ops.reverse()
}

export function diffSequence(a: string[], b: string[]): DiffOp[] {
  const ops: DiffOp[] = []

  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) {
    ops.push({ type: 'equal', aIndex: head, bIndex: head })
    head++
  }

  let endA = a.length
  let endB = b.length
  while (endA > head && endB > head && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const middle = myers(a.slice(head, endA), b.slice(head, endB))
  if (middle) {
    for (const op of middle) {
      if (op.type === 'equal') {
        ops.push({ type: 'equal', aIndex: op.aIndex + head, bIndex: op.bIndex + head })
      } else if (op.type === 'delete') {
        ops.push({ type: 'delete', aIndex: op.aIndex + head })
      } else {
        ops.push({ type: 'insert', bIndex: op.bIndex + head })
      }
    }
  } else {
    for (let i = head; i < endA; i++) ops.push({ type: 'delete', aIndex: i })
    for (let i = head; i < endB; i++) ops.push({ type: 'insert', bIndex: i })
  }

  for (let i = endA; i < a.length; i++) {
    ops.push({ type: 'equal', aIndex: i, bIndex: endB + (i - endA) })
  }

  return ops
}

function mergeRanges(indices: number[]): CharRange[] {
  if (indices.length === 0) return []
  const sorted = [...indices].sort((x, y) => x - y)
  const ranges: CharRange[] = []
  let start = sorted[0]
  let end = sorted[0] + 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end) {
      end = sorted[i] + 1
    } else {
      ranges.push({ start, end })
      start = sorted[i]
      end = sorted[i] + 1
    }
  }
  ranges.push({ start, end })
  return ranges
}

function inlineDiff(
  left: string,
  right: string
): { leftMarks: CharRange[]; rightMarks: CharRange[] } {
  if (left.length > MAX_INLINE_LENGTH || right.length > MAX_INLINE_LENGTH) {
    return {
      leftMarks: left.length > 0 ? [{ start: 0, end: left.length }] : [],
      rightMarks: right.length > 0 ? [{ start: 0, end: right.length }] : []
    }
  }

  const ops = diffSequence([...left], [...right])
  const leftIndices: number[] = []
  const rightIndices: number[] = []
  for (const op of ops) {
    if (op.type === 'delete') leftIndices.push(op.aIndex)
    else if (op.type === 'insert') rightIndices.push(op.bIndex)
  }

  return { leftMarks: mergeRanges(leftIndices), rightMarks: mergeRanges(rightIndices) }
}

export function diffRows(leftText: string, rightText: string, options: DiffOptions): DiffRow[] {
  const left = splitLines(leftText)
  const right = splitLines(rightText)
  const ops = diffSequence(
    left.map((line) => normalizeLine(line, options)),
    right.map((line) => normalizeLine(line, options))
  )

  const rows: DiffRow[] = []
  let i = 0
  while (i < ops.length) {
    const op = ops[i]

    if (op.type === 'equal') {
      rows.push({
        kind: 'equal',
        leftNo: op.aIndex + 1,
        rightNo: op.bIndex + 1,
        leftText: left[op.aIndex],
        rightText: right[op.bIndex],
        leftMarks: [],
        rightMarks: []
      })
      i++
      continue
    }

    const deletes: number[] = []
    const inserts: number[] = []
    while (i < ops.length && ops[i].type !== 'equal') {
      const current = ops[i]
      if (current.type === 'delete') deletes.push(current.aIndex)
      else if (current.type === 'insert') inserts.push(current.bIndex)
      i++
    }

    const paired = Math.min(deletes.length, inserts.length)
    for (let p = 0; p < paired; p++) {
      const leftLine = left[deletes[p]]
      const rightLine = right[inserts[p]]
      const marks = inlineDiff(leftLine, rightLine)
      rows.push({
        kind: 'modify',
        leftNo: deletes[p] + 1,
        rightNo: inserts[p] + 1,
        leftText: leftLine,
        rightText: rightLine,
        leftMarks: marks.leftMarks,
        rightMarks: marks.rightMarks
      })
    }
    for (let p = paired; p < deletes.length; p++) {
      rows.push({
        kind: 'remove',
        leftNo: deletes[p] + 1,
        rightNo: null,
        leftText: left[deletes[p]],
        rightText: '',
        leftMarks: left[deletes[p]].length > 0 ? [{ start: 0, end: left[deletes[p]].length }] : [],
        rightMarks: []
      })
    }
    for (let p = paired; p < inserts.length; p++) {
      rows.push({
        kind: 'add',
        leftNo: null,
        rightNo: inserts[p] + 1,
        leftText: '',
        rightText: right[inserts[p]],
        leftMarks: [],
        rightMarks:
          right[inserts[p]].length > 0 ? [{ start: 0, end: right[inserts[p]].length }] : []
      })
    }
  }

  return rows
}

export function diffStats(rows: DiffRow[]): DiffStats {
  const stats: DiffStats = { added: 0, removed: 0, modified: 0, unchanged: 0 }
  for (const row of rows) {
    if (row.kind === 'add') stats.added++
    else if (row.kind === 'remove') stats.removed++
    else if (row.kind === 'modify') stats.modified++
    else stats.unchanged++
  }
  return stats
}

export function hasDifference(rows: DiffRow[]): boolean {
  return rows.some((row) => row.kind !== 'equal')
}

function changedRows(rows: DiffRow[]): DiffRow[] {
  return rows.filter((row) => row.kind !== 'equal')
}

export function formatAddedText(rows: DiffRow[]): string {
  return rows
    .filter((row) => row.kind === 'add' || row.kind === 'modify')
    .map((row) => row.rightText)
    .join('\n')
}

export function formatRemovedText(rows: DiffRow[]): string {
  return rows
    .filter((row) => row.kind === 'remove' || row.kind === 'modify')
    .map((row) => row.leftText)
    .join('\n')
}

export function formatMarkedDiff(rows: DiffRow[]): string {
  const lines: string[] = []
  for (const row of changedRows(rows)) {
    if (row.kind === 'remove' || row.kind === 'modify') lines.push(`- ${row.leftText}`)
    if (row.kind === 'add' || row.kind === 'modify') lines.push(`+ ${row.rightText}`)
  }
  return lines.join('\n')
}

export function formatPairs(rows: DiffRow[]): string {
  return changedRows(rows)
    .map((row) => `${row.leftText} => ${row.rightText}`)
    .join('\n')
}

export function formatSummary(rows: DiffRow[]): string {
  const stats = diffStats(rows)
  if (stats.added === 0 && stats.removed === 0 && stats.modified === 0) {
    return '两份内容完全一致'
  }
  return [
    `新增 ${stats.added} 行`,
    `删除 ${stats.removed} 行`,
    `修改 ${stats.modified} 行`,
    `未变 ${stats.unchanged} 行`
  ].join('，')
}
