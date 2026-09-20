// 查询本机公网 IP：在 main 进程里请求，多个接口按顺序兜底。
// 放 main 而不是 renderer：renderer 的 CSP 是 default-src 'self'，直连外网会被挡。

export interface PublicIpInfo {
  ip: string
  /** 归属地 / 运营商等可读描述，拿不到就是空串 */
  detail: string
  /** 数据来源，界面上标一下便于对照 */
  source: string
}

export type PublicIpResult = ({ ok: true } & PublicIpInfo) | { ok: false; error: string }

/** 只依赖用得到的那几个成员，方便 main 传 net.fetch、测试传别的实现 */
export type Fetcher = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

interface Provider {
  name: string
  url: string
  parse: (body: string) => { ip: string; detail: string } | null
}

export const IPV4_OR_V6 = /^[0-9a-fA-F.:]+$/

function cleanIp(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!IPV4_OR_V6.test(trimmed)) return ''
  return trimmed.includes('.') || trimmed.includes(':') ? trimmed : ''
}

function joinDetail(parts: (string | undefined | null)[]): string {
  return parts.filter((part) => part !== undefined && part !== null && part !== '').join(' · ')
}

function parseJson(body: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(body)
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** ipinfo.io/json：{ ip, city, region, country, org, timezone } */
export function parseIpinfoJson(body: string): { ip: string; detail: string } | null {
  const data = parseJson(body)
  if (!data) return null
  const ip = cleanIp(data.ip)
  if (!ip) return null
  const place = joinDetail([str(data.city), str(data.region), str(data.country)])
  return { ip, detail: joinDetail([place, str(data.org)]) }
}

/** api.ip.sb/geoip：{ ip, country, region, city, isp, asn } */
export function parseIpsbJson(body: string): { ip: string; detail: string } | null {
  const data = parseJson(body)
  if (!data) return null
  const ip = cleanIp(data.ip)
  if (!ip) return null
  const place = joinDetail([str(data.city), str(data.region), str(data.country)])
  const asn = data.asn === undefined || data.asn === null ? '' : `AS${String(data.asn).trim()}`
  return { ip, detail: joinDetail([place, str(data.isp), asn]) }
}

/** myip.ipip.net 之类的纯文本：当前 IP：x.x.x.x  来自于：中国 海南 海口 电信 */
export function parseIpipText(body: string): { ip: string; detail: string } | null {
  // 这个接口有时把中文转义成 \uXXXX 返回，先解回来
  const text = body.includes('\\u')
    ? body.replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
        String.fromCharCode(parseInt(code, 16))
      )
    : body
  const ip = cleanIp(text.match(/(?:\d{1,3}\.){3}\d{1,3}/)?.[0] ?? '')
  if (!ip) return null
  const detail = text.match(/来自于[：:]\s*([^\n\r]+)/)?.[1]?.trim() ?? ''
  return { ip, detail }
}

/** api.ipify.org?format=json：{ ip } —— 没有归属地信息，当兜底 */
export function parseIpifyJson(body: string): { ip: string; detail: string } | null {
  const data = parseJson(body)
  if (!data) return null
  const ip = cleanIp(data.ip)
  return ip ? { ip, detail: '' } : null
}

/** 直接返回一行 IP 的纯文本接口 */
export function parsePlainIp(body: string): { ip: string; detail: string } | null {
  const ip = cleanIp(body.split(/\s+/)[0] ?? '')
  return ip ? { ip, detail: '' } : null
}

export const PROVIDERS: Provider[] = [
  { name: 'ipinfo.io', url: 'https://ipinfo.io/json', parse: parseIpinfoJson },
  { name: 'ip.sb', url: 'https://api.ip.sb/geoip', parse: parseIpsbJson },
  { name: 'ipip.net', url: 'https://myip.ipip.net', parse: parseIpipText },
  { name: 'ipify.org', url: 'https://api.ipify.org?format=json', parse: parseIpifyJson },
  { name: '4.ipw.cn', url: 'https://4.ipw.cn', parse: parsePlainIp }
]

export async function fetchPublicIp(
  fetcher: Fetcher,
  providers: Provider[] = PROVIDERS,
  timeoutMs = 8000
): Promise<PublicIpResult> {
  const errors: string[] = []
  for (const provider of providers) {
    try {
      const response = await fetcher(provider.url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json, text/plain;q=0.9' }
      })
      if (!response.ok) {
        errors.push(`${provider.name} HTTP ${response.status}`)
        continue
      }
      const parsed = provider.parse(await response.text())
      if (!parsed) {
        errors.push(`${provider.name} 返回内容看不懂`)
        continue
      }
      return { ok: true, ip: parsed.ip, detail: parsed.detail, source: provider.name }
    } catch (error) {
      errors.push(`${provider.name} ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { ok: false, error: errors.length > 0 ? errors.join('；') : '没有可用的查询接口' }
}
