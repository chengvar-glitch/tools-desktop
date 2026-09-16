import { normalizeDigits } from './text'
import type { SortOrder } from './lines'

export type OrderFormat = 'single' | 'double' | 'plain' | 'sql'
export type OrderExtract = 'token' | 'digits'

export interface OrderOptions {
  format: OrderFormat
  extract: OrderExtract
  dedupe: boolean
  order: SortOrder
  sqlColumn: string
  sqlQuoted: boolean
}

export interface OrderResult {
  numbers: string[]
  inputCount: number
  duplicateCount: number
  formatted: string
}

// 只按位数+字典序比较，避免超长单号被 Number 精度截断。
export function compareDigitStrings(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length
  return a < b ? -1 : a > b ? 1 : 0
}

function compareOrderKeys(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return compareDigitStrings(a, b)
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

// 单号可以是字母数字混合（如 XXW3c935e1274d4b8bc1ddd3f6d6257d），
// 所以按“非 [0-9A-Za-z_-] 即分隔符”整段保留，只丢掉纯符号片段。
const ORDER_TOKEN_RE = /[0-9A-Za-z_-]+/g

export function extractOrderNumbers(input: string, extract: OrderExtract = 'token'): string[] {
  const text = normalizeDigits(input)
  if (extract === 'digits') return text.match(/\d+/g) ?? []
  return (text.match(ORDER_TOKEN_RE) ?? []).filter((token) => /[0-9A-Za-z]/.test(token))
}

export function formatOrderNumbers(numbers: string[], options: OrderOptions): string {
  if (numbers.length === 0) return ''

  switch (options.format) {
    case 'single':
      return numbers.map((value) => `'${value}'`).join(',')
    case 'double':
      return numbers.map((value) => `"${value}"`).join(',')
    case 'sql': {
      const values = options.sqlQuoted
        ? numbers.map((value) => `'${value}'`).join(',')
        : numbers.join(',')
      const clause = `IN (${values})`
      const column = options.sqlColumn.trim()
      return column ? `${column} ${clause}` : clause
    }
    case 'plain':
    default:
      return numbers.join(',')
  }
}

export function processOrderInput(input: string, options: OrderOptions): OrderResult {
  const extracted = extractOrderNumbers(input, options.extract)
  let numbers = extracted
  if (options.dedupe) numbers = Array.from(new Set(numbers))
  const duplicateCount = extracted.length - numbers.length

  if (options.order !== 'none') {
    const direction = options.order === 'desc' ? -1 : 1
    numbers = [...numbers].sort((a, b) => direction * compareOrderKeys(a, b))
  }

  return {
    numbers,
    inputCount: extracted.length,
    duplicateCount,
    formatted: formatOrderNumbers(numbers, options)
  }
}
