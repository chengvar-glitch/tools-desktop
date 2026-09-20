// IP / CIDR 计算逻辑。IPv4 当 32 位、IPv6 当 128 位的 BigInt 处理，
// 掩码运算、包含判断、地址数量一套代码通用。
// 注意 renderer 里不能用 node:net，解析全部手写。

export type IpVersion = 4 | 6

export interface CidrEntry {
  input: string
  version: IpVersion
  /** 去掉前缀后的规范化地址 */
  address: string
  prefix: number
  netmask: string
  wildcard: string
  network: string
  /** IPv4 是广播地址；IPv6 没有广播，就是网段内最后一个地址 */
  last: string
  firstUsable: string
  lastUsable: string
  total: bigint
  usable: bigint
  scope: string
  integer: bigint
  hex: string
  /** IPv4 的 32 位二进制（点分八位组）；IPv6 太长，留空 */
  binary: string
  cidr: string
}

export interface CidrError {
  input: string
  error: string
}

export interface CidrReport {
  entries: CidrEntry[]
  errors: CidrError[]
}

export interface ContainmentResult {
  target: string
  error: string | null
  matches: {
    entry: CidrEntry
    /** 落在网段内（含网络地址与广播地址） */
    inNetwork: boolean
    /** 落在可用主机范围内 */
    inUsable: boolean
  }[]
}

const BITS: Record<IpVersion, number> = { 4: 32, 6: 128 }

interface ParsedAddress {
  value: bigint
  version: IpVersion
}

function bitsOf(version: IpVersion): bigint {
  return BigInt(BITS[version])
}

export function formatIpv4(value: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 0xffn)).join('.')
}

/** RFC 5952：最长零段压缩成 ::（只压长度 ≥2 的段，同样长时取靠前的） */
export function formatIpv6(value: bigint): string {
  const groups: number[] = []
  for (let i = 7; i >= 0; i--) groups.push(Number((value >> BigInt(i * 16)) & 0xffffn))

  let bestStart = -1
  let bestLength = 0
  let start = -1
  for (let i = 0; i <= groups.length; i++) {
    const isZero = i < groups.length && groups[i] === 0
    if (isZero && start === -1) start = i
    if (!isZero && start !== -1) {
      const length = i - start
      if (length > bestLength) {
        bestLength = length
        bestStart = start
      }
      start = -1
    }
  }

  const hex = (group: number): string => group.toString(16)
  if (bestLength < 2) return groups.map(hex).join(':')
  const head = groups.slice(0, bestStart).map(hex).join(':')
  const tail = groups
    .slice(bestStart + bestLength)
    .map(hex)
    .join(':')
  return `${head}::${tail}`
}

export function formatAddress(value: bigint, version: IpVersion): string {
  return version === 4 ? formatIpv4(value) : formatIpv6(value)
}

function parseIpv4(text: string): ParsedAddress | { error: string } {
  const parts = text.split('.')
  if (parts.length !== 4) return { error: 'IPv4 应该是 4 段点分十进制' }
  let value = 0n
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return { error: `IPv4 段 "${part}" 不是 0-255 的数字` }
    // 前导零在不同实现里会被当八进制，直接拒掉免得看错
    if (part.length > 1 && part.startsWith('0')) {
      return { error: `IPv4 段 "${part}" 有前导零（部分工具会按八进制解析）` }
    }
    const octet = Number(part)
    if (octet > 255) return { error: `IPv4 段 "${part}" 超过 255` }
    value = (value << 8n) | BigInt(octet)
  }
  return { value, version: 4 }
}

function parseIpv6(text: string): ParsedAddress | { error: string } {
  if (text === '') return { error: 'IPv6 地址为空' }
  if (text.includes('%')) return { error: 'IPv6 不支持带 % 的 zone id' }

  let body = text
  // 末尾点分 IPv4（::ffff:192.168.1.1）先折成两个 16 位组
  const v4Tail = body.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4Tail) {
    const parsed = parseIpv4(v4Tail[2])
    if ('error' in parsed) return parsed
    body = `${v4Tail[1]}${((parsed.value >> 16n) & 0xffffn).toString(16)}:${(parsed.value & 0xffffn).toString(16)}`
  }

  if ((body.match(/::/g) ?? []).length > 1) return { error: 'IPv6 里只能有一个 ::' }
  const hasGap = body.includes('::')
  const [leftText, rightText] = hasGap ? body.split('::') : [body, null]

  const parseGroups = (part: string): bigint[] | { error: string } => {
    if (part === '') return []
    const out: bigint[] = []
    for (const group of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group))
        return { error: `IPv6 组 "${group}" 不是 1-4 位十六进制` }
      out.push(BigInt(`0x${group}`))
    }
    return out
  }

  const left = parseGroups(leftText)
  if ('error' in left) return left
  let groups: bigint[]
  if (rightText === null) {
    if (left.length !== 8) return { error: `IPv6 应该是 8 组，当前 ${left.length} 组` }
    groups = left
  } else {
    const right = parseGroups(rightText)
    if ('error' in right) return right
    const fill = 8 - left.length - right.length
    if (fill < 1) return { error: ':: 至少要压缩掉一组' }
    groups = [...left, ...Array.from({ length: fill }, () => 0n), ...right]
  }

  let value = 0n
  for (const group of groups) value = (value << 16n) | group
  return { value, version: 6 }
}

export function parseAddress(text: string): ParsedAddress | { error: string } {
  const trimmed = text.trim()
  if (trimmed === '') return { error: '地址为空' }
  // 带冒号就当 IPv6（可能内含点分 IPv4 尾巴），否则按 IPv4 解析
  return trimmed.includes(':') ? parseIpv6(trimmed) : parseIpv4(trimmed)
}

function maskValue(version: IpVersion, prefix: number): bigint {
  const bits = bitsOf(version)
  if (prefix <= 0) return 0n
  return ((1n << BigInt(prefix)) - 1n) << (bits - BigInt(prefix))
}

/** 掩码必须是「前面连续 1 后面连续 0」，返回前缀长度 */
function prefixFromMask(mask: bigint, version: IpVersion): number | null {
  const binary = mask.toString(2).padStart(BITS[version], '0')
  const matched = binary.match(/^(1*)(0*)$/)
  if (!matched) return null
  return matched[1].length
}

function parsePrefix(text: string, version: IpVersion): number | { error: string } {
  const bits = BITS[version]
  if (/^\d{1,3}$/.test(text)) {
    const prefix = Number(text)
    if (prefix > bits) return { error: `${version === 4 ? 'IPv4' : 'IPv6'} 前缀不能超过 ${bits}` }
    return prefix
  }
  // 也接受 255.255.255.0 / ffff:ffff:: 这种写法
  const parsed = parseAddress(text)
  if ('error' in parsed) return { error: `前缀 "${text}" 不是数字也不是掩码` }
  if (parsed.version !== version) return { error: `前缀 "${text}" 与地址版本不一致` }
  const prefix = prefixFromMask(parsed.value, version)
  if (prefix === null) return { error: `掩码 "${text}" 不是连续的前缀掩码` }
  return prefix
}

interface ScopeRange {
  base: bigint
  prefix: number
  label: string
}

function range(base: string, prefix: number, label: string): ScopeRange {
  const parsed = parseAddress(base)
  if ('error' in parsed) throw new Error(`内置网段 ${base} 写错了`)
  return { base: parsed.value, prefix, label }
}

const V4_SCOPES: ScopeRange[] = [
  range('0.0.0.0', 8, '本网络（0.0.0.0/8）'),
  range('10.0.0.0', 8, '私有（RFC 1918）'),
  range('100.64.0.0', 10, '运营商级 NAT（RFC 6598）'),
  range('127.0.0.0', 8, '回环'),
  range('169.254.0.0', 16, '链路本地（APIPA）'),
  range('172.16.0.0', 12, '私有（RFC 1918）'),
  range('192.0.0.0', 24, 'IETF 协议保留'),
  range('192.0.2.0', 24, '文档用（TEST-NET-1）'),
  range('192.88.99.0', 24, '6to4 中继任播'),
  range('192.168.0.0', 16, '私有（RFC 1918）'),
  range('198.18.0.0', 15, '基准测试（RFC 2544）'),
  range('198.51.100.0', 24, '文档用（TEST-NET-2）'),
  range('203.0.113.0', 24, '文档用（TEST-NET-3）'),
  range('224.0.0.0', 4, '多播'),
  range('240.0.0.0', 4, '保留（含 255.255.255.255 广播）')
]

const V6_SCOPES: ScopeRange[] = [
  range('::', 128, '未指定地址'),
  range('::1', 128, '回环'),
  range('::ffff:0:0', 96, 'IPv4 映射'),
  range('64:ff9b::', 96, 'NAT64 转换'),
  range('2001::', 32, 'Teredo 隧道'),
  range('2001:db8::', 32, '文档用（RFC 3849）'),
  range('2002::', 16, '6to4'),
  range('fc00::', 7, '唯一本地（ULA）'),
  range('fe80::', 10, '链路本地'),
  range('ff00::', 8, '多播')
]

/** 命中范围里前缀最长（最具体）的那个 */
export function classifyScope(value: bigint, version: IpVersion): string {
  const ranges = version === 4 ? V4_SCOPES : V6_SCOPES
  const bits = bitsOf(version)
  let best: ScopeRange | null = null
  for (const item of ranges) {
    if (value >> (bits - BigInt(item.prefix)) !== item.base >> (bits - BigInt(item.prefix)))
      continue
    if (best === null || item.prefix > best.prefix) best = item
  }
  if (best) return best.label
  return version === 4 ? '公网（全球单播）' : '全局单播'
}

export function isInNetwork(
  value: bigint,
  base: bigint,
  prefix: number,
  version: IpVersion
): boolean {
  const shift = bitsOf(version) - BigInt(prefix)
  return value >> shift === base >> shift
}

function buildEntry(input: string, parsed: ParsedAddress, prefix: number): CidrEntry {
  const { value, version } = parsed
  const bits = bitsOf(version)
  const mask = maskValue(version, prefix)
  const wildcard = ~mask & ((1n << bits) - 1n)
  const network = value & mask
  const last = (network | wildcard) as bigint
  const total = 1n << (bits - BigInt(prefix))

  // IPv4 的 /31、/32 没有网络地址/广播地址保留位（RFC 3021），全部可用；
  // IPv6 没有广播地址，可用数就是网段总地址数
  const v4Edge = version === 4 && prefix >= 31
  const usable = version === 6 || v4Edge ? total : total - 2n
  const firstUsable = version === 6 || v4Edge ? network : network + 1n
  const lastUsable = version === 6 || v4Edge ? last : last - 1n

  const binary =
    version === 4
      ? [24n, 16n, 8n, 0n]
          .map((shift) =>
            Number((value >> shift) & 0xffn)
              .toString(2)
              .padStart(8, '0')
          )
          .join('.')
      : ''

  return {
    input,
    version,
    address: formatAddress(value, version),
    prefix,
    netmask: formatAddress(mask, version),
    wildcard: formatAddress(wildcard, version),
    network: formatAddress(network, version),
    last: formatAddress(last, version),
    firstUsable: formatAddress(firstUsable, version),
    lastUsable: formatAddress(lastUsable, version),
    total,
    usable,
    scope: classifyScope(value, version),
    integer: value,
    hex: `0x${value.toString(16).padStart(BITS[version] / 4, '0')}`,
    binary,
    cidr: `${formatAddress(network, version)}/${prefix}`
  }
}

export function parseCidr(input: string): CidrEntry | { error: string } {
  const trimmed = input.trim()
  if (trimmed === '') return { error: '空行' }
  // 允许 1.2.3.4 /24 这种带空格的写法
  const [addressText, prefixText, ...rest] = trimmed.split(/\s*\/\s*/)
  if (rest.length > 0) return { error: '一个地址只能带一个 / 前缀' }

  const parsed = parseAddress(addressText)
  if ('error' in parsed) return { error: parsed.error }

  if (prefixText === undefined) return buildEntry(trimmed, parsed, BITS[parsed.version])
  if (prefixText === '') return { error: '斜杠后面没写前缀' }

  const prefix = parsePrefix(prefixText, parsed.version)
  if (typeof prefix === 'object') return { error: prefix.error }
  return buildEntry(trimmed, parsed, prefix)
}

export function parseCidrList(input: string): CidrReport {
  const entries: CidrEntry[] = []
  const errors: CidrError[] = []
  for (const raw of input.split(/\r?\n|,/)) {
    if (raw.trim() === '') continue
    const result = parseCidr(raw)
    if ('error' in result) errors.push({ input: raw.trim(), error: result.error })
    else entries.push(result)
  }
  return { entries, errors }
}

export function findContainment(input: string, target: string): ContainmentResult {
  const trimmed = target.trim()
  const report = parseCidrList(input)
  if (trimmed === '') return { target: trimmed, error: null, matches: [] }

  // 目标自带 /xx 时只取地址部分判断
  const addressText = trimmed.includes('/') ? trimmed.split('/')[0].trim() : trimmed
  const parsed = parseAddress(addressText)
  if ('error' in parsed) return { target: trimmed, error: parsed.error, matches: [] }

  const matches: ContainmentResult['matches'] = []
  for (const entry of report.entries) {
    if (entry.version !== parsed.version) continue
    const network = parseAddress(entry.network)
    if ('error' in network) continue
    if (!isInNetwork(parsed.value, network.value, entry.prefix, entry.version)) continue

    const first = parseAddress(entry.firstUsable)
    const last = parseAddress(entry.lastUsable)
    const inUsable =
      !('error' in first) &&
      !('error' in last) &&
      parsed.value >= first.value &&
      parsed.value <= last.value
    matches.push({ entry, inNetwork: true, inUsable })
  }

  return { target: trimmed, error: null, matches }
}

const TSV_HEADER = [
  '输入',
  '版本',
  '规范化 CIDR',
  '掩码',
  '反掩码',
  '网络地址',
  '首地址',
  '末地址',
  '可用范围',
  '可用数',
  '总地址数',
  '类型',
  '整数',
  '十六进制',
  '二进制'
].join('\t')

export function formatEntryRow(entry: CidrEntry): string {
  return [
    entry.input,
    `IPv${entry.version}`,
    entry.cidr,
    entry.netmask,
    entry.wildcard,
    entry.network,
    entry.firstUsable,
    entry.lastUsable,
    `${entry.firstUsable} - ${entry.lastUsable}`,
    entry.usable.toString(),
    entry.total.toString(),
    entry.scope,
    entry.integer.toString(),
    entry.hex,
    entry.binary
  ].join('\t')
}

export function formatTsv(entries: CidrEntry[]): string {
  if (entries.length === 0) return ''
  return [TSV_HEADER, ...entries.map(formatEntryRow)].join('\n')
}

export function formatCidrList(entries: CidrEntry[]): string {
  return entries.map((entry) => entry.cidr).join('\n')
}

export function formatUsableList(entries: CidrEntry[]): string {
  return entries.map((entry) => `${entry.firstUsable} - ${entry.lastUsable}`).join('\n')
}

/** 按每条输入的原始行输出「网段 + 可用范围」，方便贴进文档 */
export function formatSummaryLines(entries: CidrEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${entry.cidr}\t掩码 ${entry.netmask}\t网络 ${entry.network}\t可用 ${entry.firstUsable}-${entry.lastUsable}（${entry.usable} 个）\t${entry.scope}`
    )
    .join('\n')
}
