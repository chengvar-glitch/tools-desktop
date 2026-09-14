import SparkMD5 from 'spark-md5'

export interface PoolOptions {
  upper: boolean
  lower: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

export interface PasswordOptions extends PoolOptions {
  length: number
  count: number
}

export interface PasswordResult {
  password: string
  bits: number
  poolSize: number
}

export interface StrengthReport {
  bits: number
  poolSize: number
  classes: string[]
  label: string
  crackSeconds: number
}

export type TokenKind = 'uuid4' | 'uuid7' | 'hex32' | 'base64url'

export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const LOWER = 'abcdefghijklmnopqrstuvwxyz'
export const DIGITS = '0123456789'
export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/'
// 容易被看错的字符：0/O、1/l/I、以及引号反斜杠这类在命令行里要转义的
export const AMBIGUOUS = '0O1lI|`\'"\\~,;:.'

function randomInt(max: number): number {
  if (max <= 0) throw new Error('max must be positive')
  // 拒绝采样，避免取模带来的分布偏斜
  const limit = Math.floor(0x100000000 / max) * max
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % max
}

function pick(pool: string): string {
  return pool[randomInt(pool.length)]
}

export function buildPools(options: PoolOptions): string[] {
  const pools: string[] = []
  const filter = (pool: string): string =>
    options.excludeAmbiguous ? [...pool].filter((char) => !AMBIGUOUS.includes(char)).join('') : pool

  if (options.upper) pools.push(filter(UPPER))
  if (options.lower) pools.push(filter(LOWER))
  if (options.digits) pools.push(filter(DIGITS))
  if (options.symbols) pools.push(filter(SYMBOLS))
  return pools.filter((pool) => pool.length > 0)
}

export function poolSize(options: PoolOptions): number {
  return buildPools(options).reduce((total, pool) => total + pool.length, 0)
}

export function generatePassword(
  options: PasswordOptions,
  pools = buildPools(options)
): PasswordResult {
  const length = Math.max(1, Math.min(options.length, 256))
  const characters: string[] = []

  // 每个选中的字符集至少出现一次，避免生成出来缺少数字/符号
  for (let i = 0; i < length; i++) {
    const pool = pools[i % pools.length]
    characters.push(pick(pool))
  }
  // Fisher–Yates 洗牌，消掉上面按顺序轮询留下的规律
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[characters[i], characters[j]] = [characters[j], characters[i]]
  }

  const combined = pools.join('')
  return {
    password: characters.join(''),
    poolSize: combined.length,
    bits: length * Math.log2(combined.length || 1)
  }
}

export function generatePasswords(options: PasswordOptions): PasswordResult[] {
  const pools = buildPools(options)
  if (pools.length === 0) return []
  const count = Math.max(1, Math.min(options.count, 100))
  return Array.from({ length: count }, () => generatePassword(options, pools))
}

export function describeClasses(value: string): string[] {
  const classes: string[] = []
  if (/[A-Z]/.test(value)) classes.push('大写')
  if (/[a-z]/.test(value)) classes.push('小写')
  if (/[0-9]/.test(value)) classes.push('数字')
  if (/[^A-Za-z0-9]/.test(value)) classes.push('符号')
  return classes
}

export function charsetSizeFor(value: string): number {
  let size = 0
  if (/[A-Z]/.test(value)) size += 26
  if (/[a-z]/.test(value)) size += 26
  if (/[0-9]/.test(value)) size += 10
  if (/[^A-Za-z0-9]/.test(value)) size += 33
  return size
}

function strengthLabel(bits: number): string {
  if (bits < 28) return '很弱'
  if (bits < 40) return '弱'
  if (bits < 60) return '中等'
  if (bits < 90) return '强'
  return '极强'
}

// 按每秒 1000 亿次猜测估算离线爆破时间（量级参考，不追求精确）
const GUESSES_PER_SECOND = 1e11

export function estimateStrength(value: string): StrengthReport {
  const poolSize = charsetSizeFor(value)
  const bits = value.length === 0 ? 0 : value.length * Math.log2(poolSize || 1)
  return {
    bits,
    poolSize,
    classes: describeClasses(value),
    label: strengthLabel(bits),
    crackSeconds: bits === 0 ? 0 : 2 ** (bits - 1) / GUESSES_PER_SECOND
  }
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '瞬间'
  if (seconds < 1) return '不到 1 秒'
  const units: [number, string][] = [
    [60, '秒'],
    [60, '分钟'],
    [24, '小时'],
    [365, '天'],
    [100, '年'],
    [10000, '世纪']
  ]
  let value = seconds
  let index = 0
  while (index < units.length - 1 && value >= units[index][0]) {
    value /= units[index][0]
    index++
  }
  if (index === units.length - 1 && value > 1e6) return '远超宇宙年龄'
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index][1]}`
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

// RFC 9562 的 UUID v7：48 位毫秒时间戳 + 版本 + 74 位随机数，按时间递增
function uuidV7(): string {
  const bytes = randomBytes(16)
  const timestamp = Date.now()
  bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff
  bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff
  bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff
  bytes[4] = Math.floor(timestamp / 2 ** 8) & 0xff
  bytes[5] = timestamp & 0xff
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function randomToken(kind: TokenKind): string {
  switch (kind) {
    case 'uuid4':
      return crypto.randomUUID()
    case 'uuid7':
      return uuidV7()
    case 'hex32':
      return bytesToHex(randomBytes(16))
    case 'base64url':
    default:
      return bytesToBase64(randomBytes(24))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
  }
}

/* ---------------- 哈希 ---------------- */

export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export const HASH_ALGORITHMS: HashAlgorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

export async function hashText(algorithm: HashAlgorithm, text: string): Promise<string> {
  if (algorithm === 'MD5') return SparkMD5.hash(text, false)
  const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(text))
  return bytesToHex(new Uint8Array(digest))
}

/* ---------------- Base64 ---------------- */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function base64Encode(text: string, urlSafe: boolean): string {
  const encoded = bytesToBase64(new TextEncoder().encode(text))
  if (!urlSafe) return encoded
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64Decode(
  text: string
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: '内容为空' }
  try {
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      return { ok: false, error: '含有 Base64 之外的字符' }
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(normalized))
    return { ok: true, value: decoded }
  } catch {
    return { ok: false, error: '不是合法的 Base64（或解码后不是 UTF-8 文本）' }
  }
}
