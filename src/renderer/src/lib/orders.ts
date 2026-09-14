import { normalizeDigits } from './text'
import type { SortOrder } from './lines'

export type OrderFormat = 'single' | 'double' | 'plain' | 'sql'

export interface OrderOptions {
  format: OrderFormat
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

export const ORDER_FORMAT_LABELS: Record<OrderFormat, string> = {
  single: "单引号 '123','456'",
  double: '双引号 "123","456"',
  plain: '纯数字 123,456',
  sql: 'SQL IN'
}

// 只按位数+字典序比较，避免超长单号被 Number 精度截断。
export function compareDigitStrings(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length
  return a < b ? -1 : a > b ? 1 : 0
}

export function extractOrderNumbers(input: string): string[] {
  return normalizeDigits(input).match(/\d+/g) ?? []
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
  const extracted = extractOrderNumbers(input)
  let numbers = extracted
  if (options.dedupe) numbers = Array.from(new Set(numbers))
  const duplicateCount = extracted.length - numbers.length

  if (options.order !== 'none') {
    const direction = options.order === 'desc' ? -1 : 1
    numbers = [...numbers].sort((a, b) => direction * compareDigitStrings(a, b))
  }

  return {
    numbers,
    inputCount: extracted.length,
    duplicateCount,
    formatted: formatOrderNumbers(numbers, options)
  }
}
