// 正则测试的纯逻辑：编译、匹配、替换、高亮分段。
// 始终带 g 标志（matchAll 要求全局匹配），额外用 d 标志拿分组下标，用来在结果里给分组定位。

export interface RegexOptions {
  ignoreCase: boolean
  multiline: boolean
  dotAll: boolean
  unicode: boolean
}

export interface RegexGroup {
  label: string
  value: string | undefined
  start: number
  end: number
}

export interface RegexMatch {
  /** 匹配编号，从 1 开始，方便在界面和复制结果里对照 */
  no: number
  index: number
  end: number
  value: string
  groups: RegexGroup[]
  named: Record<string, string>
}

export interface RegexRun {
  matches: RegexMatch[]
  error: string | null
  /** 是否因为命中上限被截断 */
  truncated: boolean
}

export interface RegexReplace {
  text: string
  error: string | null
}

export interface HighlightSegment {
  text: string
  matched: boolean
}

export const DEFAULT_OPTIONS: RegexOptions = {
  ignoreCase: false,
  multiline: false,
  dotAll: false,
  unicode: false
}

// 上限只是防止 (.*) 之类在长文本上匹配出几十万条把界面卡死
export const MAX_MATCHES = 5000

export function flagString(options: RegexOptions): string {
  return (
    (options.ignoreCase ? 'i' : '') +
    (options.multiline ? 'm' : '') +
    (options.dotAll ? 's' : '') +
    (options.unicode ? 'u' : '')
  )
}

export function compileRegex(
  pattern: string,
  options: RegexOptions
): { re: RegExp | null; error: string | null } {
  if (pattern === '') return { re: null, error: null }
  try {
    return { re: new RegExp(pattern, `g${flagString(options)}d`), error: null }
  } catch (err) {
    return { re: null, error: err instanceof Error ? err.message : String(err) }
  }
}

function toMatch(match: RegExpMatchArray, no: number): RegexMatch {
  const index = match.index ?? 0
  const indices = match.indices ?? []
  const groups: RegexGroup[] = []
  for (let i = 1; i < match.length; i++) {
    const span = indices[i]
    groups.push({
      label: String(i),
      value: match[i],
      start: span ? span[0] : -1,
      end: span ? span[1] : -1
    })
  }

  const named: Record<string, string> = {}
  for (const [name, value] of Object.entries(match.groups ?? {})) {
    if (value !== undefined) named[name] = value
  }

  return { no, index, end: index + match[0].length, value: match[0], groups, named }
}

export function runRegex(
  pattern: string,
  input: string,
  options: RegexOptions = DEFAULT_OPTIONS
): RegexRun {
  const { re, error } = compileRegex(pattern, options)
  if (error) return { matches: [], error, truncated: false }
  if (!re || input === '') return { matches: [], error: null, truncated: false }

  const matches: RegexMatch[] = []
  let truncated = false
  for (const match of input.matchAll(re)) {
    if (matches.length >= MAX_MATCHES) {
      truncated = true
      break
    }
    matches.push(toMatch(match, matches.length + 1))
  }
  return { matches, error: null, truncated }
}

export function replaceWithRegex(
  pattern: string,
  input: string,
  replacement: string,
  options: RegexOptions = DEFAULT_OPTIONS
): RegexReplace {
  const { re, error } = compileRegex(pattern, options)
  if (error) return { text: '', error }
  if (!re) return { text: input, error: null }

  // 替换串里的 $1 / $<name> / $& 交给引擎自己展开，不重复实现
  return { text: input.replace(re, replacement), error: null }
}

/** 匹配处按命中/未命中切成片段，供界面渲染高亮；零宽匹配没法高亮，跳过 */
export function highlightMatches(input: string, matches: RegexMatch[]): HighlightSegment[] {
  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.end <= match.index || match.index < cursor) continue
    if (match.index > cursor)
      segments.push({ text: input.slice(cursor, match.index), matched: false })
    segments.push({ text: input.slice(match.index, match.end), matched: true })
    cursor = match.end
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), matched: false })
  return segments
}

/** 每行起始 offset，用来把匹配位置换算成行列（二分查找，避免每个匹配都扫全文） */
export function buildLineIndex(input: string): number[] {
  const starts = [0]
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\n') starts.push(i + 1)
  }
  return starts
}

export function lineColumnAt(starts: number[], index: number): { line: number; column: number } {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid] <= index) low = mid
    else high = mid - 1
  }
  return { line: low + 1, column: index - starts[low] + 1 }
}

export function formatMatchList(input: string, matches: RegexMatch[]): string {
  if (matches.length === 0) return ''
  const starts = buildLineIndex(input)
  return matches
    .map((match) => {
      const { line, column } = lineColumnAt(starts, match.index)
      const head = `#${match.no} L${line}:${column} ${JSON.stringify(match.value)}`
      const named = Object.entries(match.named).map(([name, value]) => `  <${name}> ${value}`)
      // 有名分组已经单独列过，编号分组里值重复的就不再重复列
      const namedValues = new Set(Object.values(match.named))
      const numbered = match.groups
        .filter((group) => group.value !== undefined && !namedValues.has(group.value))
        .map((group) => `  $${group.label} ${group.value}`)
      return [head, ...named, ...numbered].join('\n')
    })
    .join('\n')
}

export function formatMatchValues(matches: RegexMatch[]): string {
  return matches.map((match) => match.value).join('\n')
}
