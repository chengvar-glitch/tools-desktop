import JSON5 from 'json5'
import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser'
import { parse as parseYamlDocument, stringify as stringifyYamlDocument } from 'yaml'

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface JsonError {
  message: string
  line: number | null
  column: number | null
  /** 面向人的解释，例如“缺少逗号” */
  hint?: string
}

export type ParseResult = { ok: true; value: JsonValue } | { ok: false; error: JsonError }
export type TextResult = { ok: true; value: string } | { ok: false; error: JsonError }

export interface JsonStats {
  type: string
  keys: number
  depth: number
  length: number
  bytes: number
}

export type Indent = '2' | '4' | 'tab'

const INDENT_VALUE: Record<Indent, string | number> = { '2': 2, '4': 4, tab: '\t' }

export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length))
  const lines = text.slice(0, clamped).split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

// 新版 V8 的报错常常只给一段上下文片段、不给位置，所以位置一律用 jsonc-parser 的
// 错误偏移来算；它同时能给出更贴近人话的错误类型。
const HINTS: Record<string, string> = {
  InvalidSymbol: '出现了非法字符',
  InvalidNumberFormat: '数字格式不对',
  PropertyNameExpected: '需要属性名（键名必须用双引号包起来）',
  ValueExpected: '缺少值',
  ColonExpected: '缺少冒号',
  CommaExpected: '缺少逗号',
  CloseBraceExpected: '缺少 }',
  CloseBracketExpected: '缺少 ]',
  EndOfFileExpected: 'JSON 结束后还有多余内容',
  InvalidCommentToken: '注释写法不合法',
  UnexpectedEndOfComment: '注释没有闭合',
  UnexpectedEndOfString: '字符串没有闭合',
  UnexpectedEndOfNumber: '数字没有写完',
  InvalidUnicode: 'Unicode 转义不合法',
  InvalidEscapeCharacter: '转义字符不合法',
  InvalidCharacter: '出现了非法字符'
}

function locateStrictError(text: string): { line: number; column: number; hint?: string } | null {
  const errors: ParseError[] = []
  parseJsonc(text, errors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false
  })
  const first = errors[0]
  if (!first) return null
  const { line, column } = offsetToLineColumn(text, first.offset)
  return { line, column, hint: HINTS[printParseErrorCode(first.error)] }
}

function describeJsonError(error: unknown, text: string): JsonError {
  const message = error instanceof Error ? error.message : String(error)
  const located = locateStrictError(text)
  if (located) return { message, line: located.line, column: located.column, hint: located.hint }

  // 兜底：老版本 V8 的消息里会直接带位置
  const lineColumn = message.match(/\(line (\d+) column (\d+)\)/)
  if (lineColumn) {
    return { message, line: Number(lineColumn[1]), column: Number(lineColumn[2]) }
  }
  const position = message.match(/at position (\d+)/)
  if (position) {
    const { line, column } = offsetToLineColumn(text, Number(position[1]))
    return { message, line, column }
  }
  if (/end of (json )?(input|data)/i.test(message)) {
    const { line, column } = offsetToLineColumn(text, text.length)
    return { message, line, column }
  }
  return { message, line: null, column: null }
}

export function parseJson(text: string, lenient: boolean): ParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: { message: '内容为空', line: null, column: null } }

  if (lenient) {
    try {
      return { ok: true, value: JSON5.parse(trimmed) as JsonValue }
    } catch (error) {
      const detail = error as { message?: string; lineNumber?: number; columnNumber?: number }
      return {
        ok: false,
        error: {
          message: detail.message ?? String(error),
          line: detail.lineNumber ?? null,
          column: detail.columnNumber ?? null
        }
      }
    }
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) as JsonValue }
  } catch (error) {
    return { ok: false, error: describeJsonError(error, text) }
  }
}

export function formatJson(value: JsonValue, indent: Indent): string {
  return JSON.stringify(value, null, INDENT_VALUE[indent])
}

export function minifyJson(value: JsonValue): string {
  return JSON.stringify(value)
}

export function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const sorted: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortKeysDeep(value[key])
    }
    return sorted
  }
  return value
}

export function describeType(value: JsonValue): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `数组（${value.length} 项）`
  if (typeof value === 'object') return `对象（${Object.keys(value).length} 个键）`
  return typeof value === 'string' ? '字符串' : typeof value === 'number' ? '数字' : '布尔'
}

export function jsonStats(value: JsonValue): JsonStats {
  let keys = 0
  let depth = 0
  const walk = (node: JsonValue, level: number): void => {
    depth = Math.max(depth, level)
    if (Array.isArray(node)) {
      for (const item of node) walk(item, level + 1)
    } else if (node !== null && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        keys++
        walk(node[key], level + 1)
      }
    }
  }
  walk(value, 1)

  const serialized = JSON.stringify(value) ?? ''
  return {
    type: describeType(value),
    keys,
    depth,
    length: serialized.length,
    bytes: new TextEncoder().encode(serialized).length
  }
}

export function escapeJsonString(text: string): string {
  return JSON.stringify(text)
}

export function unescapeJsonString(text: string): TextResult {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: { message: '内容为空', line: null, column: null } }
  // 没有引号包起来时直接补上引号，这样里面的 \n \t \uXXXX 才会被当成转义解析
  // （不能走 JSON.stringify，那会把反斜杠再转义一次）
  const wrapped = /^["']/.test(trimmed) ? trimmed : `"${trimmed}"`
  try {
    const parsed = JSON5.parse(wrapped)
    if (typeof parsed !== 'string') {
      return { ok: false, error: { message: '反转义结果不是字符串', line: null, column: null } }
    }
    return { ok: true, value: parsed }
  } catch (error) {
    const detail = error as { message?: string; lineNumber?: number; columnNumber?: number }
    return {
      ok: false,
      error: {
        message: detail.message ?? String(error),
        line: detail.lineNumber ?? null,
        column: detail.columnNumber ?? null
      }
    }
  }
}

export function toYaml(value: JsonValue): string {
  return stringifyYamlDocument(value, { indent: 2, lineWidth: 0 })
}

export function parseYaml(text: string): ParseResult {
  if (text.trim() === '') {
    return { ok: false, error: { message: '内容为空', line: null, column: null } }
  }
  try {
    // 过一遍 JSON 序列化，把 YAML 的日期/Map 等收敛成 JSON 能表达的值
    const value = parseYamlDocument(text)
    return { ok: true, value: JSON.parse(JSON.stringify(value ?? null)) as JsonValue }
  } catch (error) {
    const detail = error as { message?: string; linePos?: { line: number; col: number }[] }
    const first = detail.linePos?.[0]
    return {
      ok: false,
      error: {
        message: detail.message ?? String(error),
        line: first?.line ?? null,
        column: first?.col ?? null
      }
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/* ---------------- JSON → TypeScript ---------------- */

interface TsContext {
  usedNames: Map<string, number>
  interfaces: string[]
}

function pascalCase(name: string): string {
  const joined = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
  if (joined === '') return 'Item'
  return /^[0-9]/.test(joined) ? `N${joined}` : joined
}

function fieldName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}

function uniqueName(base: string, context: TsContext): string {
  const count = context.usedNames.get(base) ?? 0
  context.usedNames.set(base, count + 1)
  return count === 0 ? base : `${base}${count + 1}`
}

function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function pushInterface(name: string, lines: string[], context: TsContext): string {
  context.interfaces.push(
    lines.length === 0
      ? `export interface ${name} {}`
      : `export interface ${name} {\n${lines.join('\n')}\n}`
  )
  return name
}

// 数组里的对象合并成一个接口，只在部分元素里出现的键标成可选
function objectInterface(
  objects: { [key: string]: JsonValue }[],
  baseName: string,
  context: TsContext
): string {
  const name = uniqueName(pascalCase(baseName), context)
  const keys: string[] = []
  for (const object of objects) {
    for (const key of Object.keys(object)) {
      if (!keys.includes(key)) keys.push(key)
    }
  }

  const lines = keys.map((key) => {
    const present = objects.filter((object) => key in object)
    const types = new Set(
      present.map((object) => valueType(object[key], `${baseName}${pascalCase(key)}`, context))
    )
    const optional = present.length < objects.length ? '?' : ''
    return `  ${fieldName(key)}${optional}: ${[...types].join(' | ')}`
  })
  return pushInterface(name, lines, context)
}

function valueType(value: JsonValue, name: string, context: TsContext): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    const objects = value.filter(isPlainObject)
    if (objects.length === value.length) return `${objectInterface(objects, name, context)}[]`
    const types = new Set(value.map((item) => valueType(item, name, context)))
    const union = [...types].join(' | ')
    return types.size > 1 ? `(${union})[]` : `${union}[]`
  }
  if (isPlainObject(value)) return objectInterface([value], name, context)
  return typeof value
}

export function toTypeScript(value: JsonValue, rootName = 'Root'): string {
  const context: TsContext = { usedNames: new Map(), interfaces: [] }
  const name = pascalCase(rootName)

  if (Array.isArray(value)) {
    // 根是数组时元素接口叫 XxxItem，避免和根类型别名重名
    const type = valueType(value, `${rootName}Item`, context)
    return [...context.interfaces, `export type ${name} = ${type}`].join('\n\n')
  }
  if (isPlainObject(value)) {
    objectInterface([value], rootName, context)
    return context.interfaces.join('\n\n')
  }
  return `export type ${name} = ${value === null ? 'null' : typeof value}`
}
