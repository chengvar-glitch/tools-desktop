import { splitLines } from './text'

export type SortOrder = 'none' | 'asc' | 'desc'
export type SortMode = 'natural' | 'string' | 'numeric' | 'length'
export type DedupeMode = 'none' | 'first' | 'last'

export interface ListOptions {
  order: SortOrder
  mode: SortMode
  ignoreCase: boolean
  ignoreWhitespace: boolean
  dropEmpty: boolean
  dedupe: DedupeMode
}

export interface ListResult {
  lines: string[]
  duplicates: string[]
  removedDuplicates: string[]
  inputCount: number
  duplicateGroups: number
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'variant' })

function numberValue(value: string): number {
  const match = value.match(/-?\d+(\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : Number.NaN
}

function compareNumeric(a: string, b: string): number {
  const left = numberValue(a)
  const right = numberValue(b)
  const leftNaN = Number.isNaN(left)
  const rightNaN = Number.isNaN(right)
  if (leftNaN && rightNaN) return 0
  if (leftNaN) return 1
  if (rightNaN) return -1
  return left - right
}

function compareLength(a: string, b: string): number {
  return a.length - b.length || collator.compare(a, b)
}

function buildComparator(mode: SortMode): (a: string, b: string) => number {
  switch (mode) {
    case 'string':
      return (a, b) => (a < b ? -1 : a > b ? 1 : 0)
    case 'numeric':
      return compareNumeric
    case 'length':
      return compareLength
    case 'natural':
    default:
      return (a, b) => collator.compare(a, b)
  }
}

function keyOf(value: string, options: ListOptions): string {
  return options.ignoreCase ? value.toLowerCase() : value
}

export function processLines(input: string, options: ListOptions): ListResult {
  let values = splitLines(input)
  if (options.ignoreWhitespace) values = values.map((line) => line.trim())
  if (options.dropEmpty) values = values.filter((line) => line !== '')
  const inputCount = values.length

  let entries = values.map((value, index) => ({ value, index }))
  const removedDuplicates: string[] = []

  if (options.dedupe === 'first') {
    const seen = new Set<string>()
    entries = entries.filter((entry) => {
      const key = keyOf(entry.value, options)
      if (seen.has(key)) {
        removedDuplicates.push(entry.value)
        return false
      }
      seen.add(key)
      return true
    })
  } else if (options.dedupe === 'last') {
    const seen = new Set<string>()
    const kept: typeof entries = []
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      const key = keyOf(entry.value, options)
      if (seen.has(key)) {
        removedDuplicates.push(entry.value)
      } else {
        seen.add(key)
        kept.push(entry)
      }
    }
    kept.reverse()
    removedDuplicates.reverse()
    entries = kept
  }

  const counts = countOccurrences(values, options.ignoreCase)
  const duplicates: string[] = []
  const pushedKeys = new Set<string>()
  for (const value of values) {
    const key = keyOf(value, options)
    if (pushedKeys.has(key) || (counts.get(key) ?? 0) < 2) continue
    pushedKeys.add(key)
    duplicates.push(value)
  }

  if (options.order !== 'none') {
    const comparator = buildComparator(options.mode)
    const direction = options.order === 'desc' ? -1 : 1
    entries.sort((a, b) => direction * comparator(a.value, b.value))
  } else {
    entries.sort((a, b) => a.index - b.index)
  }

  return {
    lines: entries.map((entry) => entry.value),
    duplicates,
    removedDuplicates,
    inputCount,
    duplicateGroups: duplicates.length
  }
}

export function countOccurrences(values: string[], ignoreCase: boolean): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const key = ignoreCase ? value.toLowerCase() : value
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}
