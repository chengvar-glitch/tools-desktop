// 断言式自检：pnpm check:ip（Node 20+ 能直接 import .ts，无需构建）
import assert from 'node:assert/strict'
import {
  parseCidr,
  parseCidrList,
  parseAddress,
  findContainment,
  classifyScope,
  formatIpv6,
  formatIpv4,
  formatTsv,
  formatCidrList,
  formatUsableList
} from '../src/renderer/src/lib/ip.ts'
import {
  fetchPublicIp,
  parseIpinfoJson,
  parseIpsbJson,
  parseIpifyJson,
  parseIpipText,
  parsePlainIp
} from '../src/main/publicIp.ts'

const ok = (text) => {
  const result = parseCidr(text)
  assert.ok(!('error' in result), `${text} 应该解析成功，实际：${result.error}`)
  return result
}
const bad = (text) => {
  const result = parseCidr(text)
  assert.ok('error' in result, `${text} 应该解析失败`)
  return result.error
}

// 基本 IPv4
let e = ok('192.168.1.10/24')
assert.equal(e.version, 4)
assert.equal(e.address, '192.168.1.10')
assert.equal(e.prefix, 24)
assert.equal(e.netmask, '255.255.255.0')
assert.equal(e.wildcard, '0.0.0.255')
assert.equal(e.network, '192.168.1.0')
assert.equal(e.last, '192.168.1.255')
assert.equal(e.firstUsable, '192.168.1.1')
assert.equal(e.lastUsable, '192.168.1.254')
assert.equal(e.total, 256n)
assert.equal(e.usable, 254n)
assert.equal(e.scope, '私有（RFC 1918）')
assert.equal(e.integer, 3232235786n)
assert.equal(e.hex, '0xc0a8010a')
assert.equal(e.binary, '11000000.10101000.00000001.00001010')
assert.equal(e.cidr, '192.168.1.0/24')

// 不带前缀默认按主机地址（/32、/128）
assert.equal(ok('8.8.8.8').prefix, 32)
assert.equal(ok('8.8.8.8').usable, 1n)
assert.equal(ok('2001:db8::1').prefix, 128)

// 边界前缀
e = ok('0.0.0.0/0')
assert.equal(e.network, '0.0.0.0')
assert.equal(e.last, '255.255.255.255')
assert.equal(e.total, 4294967296n)
assert.equal(e.usable, 4294967294n)
assert.equal(e.netmask, '0.0.0.0')

e = ok('10.0.0.1/32')
assert.equal(e.usable, 1n)
assert.equal(e.firstUsable, '10.0.0.1')
assert.equal(e.lastUsable, '10.0.0.1')

// /31 是点对点网段，两个地址都可用（RFC 3021）
e = ok('10.0.0.0/31')
assert.equal(e.total, 2n)
assert.equal(e.usable, 2n)
assert.equal(e.firstUsable, '10.0.0.0')
assert.equal(e.lastUsable, '10.0.0.1')

// 掩码写法
assert.equal(ok('10.0.0.0/255.255.255.0').prefix, 24)
assert.equal(ok('10.0.0.0/255.255.255.192').prefix, 26)
assert.equal(ok('2001:db8::/ffff:ffff::').prefix, 32)
assert.ok(bad('10.0.0.0/255.0.255.0').includes('连续'))
assert.ok(bad('10.0.0.0/33').includes('不能超过'))
assert.ok(bad('2001:db8::/129').includes('不能超过'))
assert.ok(bad('10.0.0.0/').includes('没写前缀'))

// 空格写法
e = ok('10.0.0.1 / 24')
assert.equal(e.network, '10.0.0.0')

// 非法输入
assert.ok(bad('192.168.1.256').includes('超过 255'))
assert.ok(bad('192.168.1').includes('4 段'))
assert.ok(bad('192.168.01.1').includes('前导零'))
assert.ok(bad('1.2.3.4.5').includes('4 段'))
assert.ok(bad('gggg::1').includes('十六进制'))
assert.ok(bad('1::2::3').includes('一个 ::'))
assert.ok(bad('2001:db8::1::').includes('一个 ::'))
assert.ok(bad('12345::1').includes('十六进制'))
assert.ok(bad('1.2.3.4/24/8').includes('一个 /'))
assert.ok(bad('fe80::1%eth0').includes('zone'))

// IPv6
e = ok('2001:db8::1/64')
assert.equal(e.version, 6)
assert.equal(e.network, '2001:db8::')
assert.equal(e.last, '2001:db8::ffff:ffff:ffff:ffff')
assert.equal(e.netmask, 'ffff:ffff:ffff:ffff::')
assert.equal(e.wildcard, '::ffff:ffff:ffff:ffff')
assert.equal(e.total, 18446744073709551616n)
assert.equal(e.usable, e.total)
assert.equal(e.firstUsable, '2001:db8::')
assert.equal(e.scope, '文档用（RFC 3849）')
assert.equal(e.hex, '0x20010db8000000000000000000000001')
assert.equal(e.binary, '')

e = ok('::1/128')
assert.equal(e.scope, '回环')
assert.equal(e.cidr, '::1/128')
assert.equal(e.total, 1n)

e = ok('2001:db8:0:0:0:0:0:1/64')
assert.equal(e.address, '2001:db8::1')

// IPv4 映射 / 内嵌 IPv4 写法
e = ok('::ffff:192.168.1.1/120')
assert.equal(e.address, '::ffff:c0a8:101')
assert.equal(e.scope, 'IPv4 映射')
assert.equal(e.network, '::ffff:c0a8:100')
e = ok('::ffff:0:0/96')
assert.equal(e.scope, 'IPv4 映射')

// RFC 5952 压缩
assert.equal(formatIpv6(0n), '::')
assert.equal(formatIpv6(1n), '::1')
assert.equal(formatIpv6((1n << 128n) - 1n), 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
assert.equal(formatIpv6(0x20010db8n << 96n), '2001:db8::')
assert.equal(formatIpv6((1n << 127n) + 1n), '8000::1')
assert.equal(formatIpv4(0n), '0.0.0.0')
assert.equal(formatIpv4(4294967295n), '255.255.255.255')

// 组数组折成 128 位整数，方便写压缩用例
const fromGroups = (groups) => groups.reduce((acc, g) => (acc << 16n) | BigInt(g), 0n)
// 单个零组不压缩
assert.equal(formatIpv6(fromGroups([0x2001, 0xdb8, 0, 1, 1, 1, 1, 1])), '2001:db8:0:1:1:1:1:1')
// 最长零段压缩
assert.equal(formatIpv6(fromGroups([0x2001, 0xdb8, 0, 1, 0, 0, 0, 1])), '2001:db8:0:1::1')
// 同样长的零段取靠前的那个
assert.equal(formatIpv6(fromGroups([1, 0, 0, 2, 0, 0, 3, 4])), '1::2:0:0:3:4')
// 零段在开头 / 结尾
assert.equal(formatIpv6(fromGroups([0, 0, 0, 1, 2, 3, 4, 5])), '::1:2:3:4:5')
assert.equal(formatIpv6(fromGroups([1, 2, 3, 4, 5, 0, 0, 0])), '1:2:3:4:5::')

// 地址类型
assert.equal(classifyScope(parseAddress('100.64.0.1').value, 4), '运营商级 NAT（RFC 6598）')
assert.equal(classifyScope(parseAddress('169.254.1.1').value, 4), '链路本地（APIPA）')
assert.equal(classifyScope(parseAddress('127.0.0.1').value, 4), '回环')
assert.equal(classifyScope(parseAddress('224.0.0.1').value, 4), '多播')
assert.equal(classifyScope(parseAddress('240.0.0.1').value, 4), '保留（含 255.255.255.255 广播）')
assert.equal(
  classifyScope(parseAddress('255.255.255.255').value, 4),
  '保留（含 255.255.255.255 广播）'
)
assert.equal(classifyScope(parseAddress('198.51.100.1').value, 4), '文档用（TEST-NET-2）')
assert.equal(classifyScope(parseAddress('172.20.0.1').value, 4), '私有（RFC 1918）')
assert.equal(classifyScope(parseAddress('8.8.8.8').value, 4), '公网（全球单播）')
assert.equal(classifyScope(parseAddress('0.0.0.0').value, 4), '本网络（0.0.0.0/8）')
assert.equal(classifyScope(parseAddress('fc00::1').value, 6), '唯一本地（ULA）')
assert.equal(classifyScope(parseAddress('fe80::1').value, 6), '链路本地')
assert.equal(classifyScope(parseAddress('ff02::1').value, 6), '多播')
assert.equal(classifyScope(parseAddress('2002::1').value, 6), '6to4')
assert.equal(classifyScope(parseAddress('64:ff9b::1').value, 6), 'NAT64 转换')
assert.equal(classifyScope(parseAddress('2606:4700::1111').value, 6), '全局单播')

// 批量：空行与逗号跳过，坏行单独收集
const report = parseCidrList('10.0.0.0/8\n\n192.168.1.1/24, 300.1.1.1\n2001:db8::/32\n')
assert.equal(report.entries.length, 3)
assert.equal(report.errors.length, 1)
assert.equal(report.errors[0].input, '300.1.1.1')

// 包含判断
const list = '10.0.0.0/24\n192.168.0.0/16\n2001:db8::/32'
let c = findContainment(list, '10.0.0.5')
assert.equal(c.matches.length, 1)
assert.equal(c.matches[0].inUsable, true)
c = findContainment(list, '10.0.0.0')
assert.equal(c.matches[0].inNetwork, true)
assert.equal(c.matches[0].inUsable, false)
c = findContainment(list, '10.0.0.255')
assert.equal(c.matches[0].inNetwork, true)
assert.equal(c.matches[0].inUsable, false)
c = findContainment(list, '10.0.1.1')
assert.equal(c.matches.length, 0)
c = findContainment(list, '2001:db8::abcd')
assert.equal(c.matches.length, 1)
assert.equal(c.matches[0].entry.version, 6)
// IPv4 与 IPv6 不互相匹配
assert.equal(findContainment('2001:db8::/32', '10.0.0.1').matches.length, 0)
// 目标自带前缀时只看地址部分
assert.equal(findContainment(list, '10.0.0.5/32').matches.length, 1)
assert.equal(findContainment(list, '').matches.length, 0)
assert.ok(findContainment(list, '999.1.1.1').error)

// 复制文本
assert.equal(formatCidrList([ok('10.1.2.3/24')]), '10.1.2.0/24')
assert.equal(formatUsableList([ok('10.1.2.3/30')]), '10.1.2.1 - 10.1.2.2')
const tsv = formatTsv([ok('10.0.0.1/24'), ok('2001:db8::/64')])
assert.equal(tsv.split('\n').length, 3)
assert.ok(tsv.split('\n')[0].startsWith('输入\t版本\t'))
assert.equal(tsv.split('\n')[1].split('\t').length, 15)
assert.equal(tsv.split('\n')[1].split('\t')[2], '10.0.0.0/24')
assert.equal(tsv.split('\n')[2].split('\t')[2], '2001:db8::/64')
assert.equal(formatTsv([]), '')

// ---- 公网 IP 查询的响应解析（fixture 带真实字段，不发网络请求）----
// ipinfo.io/json
const ipinfoBody = JSON.stringify({
  ip: '140.240.27.69',
  city: 'Haikou',
  region: 'Hainan',
  country: 'CN',
  loc: '20.0342,110.3465',
  org: 'AS4134 CHINANET BACKBONE',
  postal: '570000',
  timezone: 'Asia/Shanghai'
})
assert.deepEqual(parseIpinfoJson(ipinfoBody), {
  ip: '140.240.27.69',
  detail: 'Haikou · Hainan · CN · AS4134 CHINANET BACKBONE'
})
assert.equal(parseIpinfoJson('{"ip":"1.2.3.4"}').detail, '')
assert.equal(parseIpinfoJson('<html>502 Bad Gateway</html>'), null)
assert.equal(parseIpinfoJson('{"ip":"not-an-ip"}'), null)
assert.equal(parseIpinfoJson('{}'), null)

// api.ip.sb/geoip
assert.deepEqual(
  parseIpsbJson(
    JSON.stringify({
      ip: '140.240.27.69',
      country: 'China',
      region: 'Hainan',
      city: 'Haikou',
      isp: 'China Telecom',
      asn: 4134
    })
  ),
  { ip: '140.240.27.69', detail: 'Haikou · Hainan · China · China Telecom · AS4134' }
)

// myip.ipip.net 纯文本
assert.deepEqual(parseIpipText('当前 IP：140.240.27.69  来自于：中国 海南 海口 电信'), {
  ip: '140.240.27.69',
  detail: '中国 海南 海口 电信'
})
const escaped = '\\u5f53\\u524d IP\\uff1a140.240.27.69  \\u6765\\u81ea\\u4e8e\\uff1a\\u4e2d\\u56fd \\u6d77\\u5357'
assert.deepEqual(parseIpipText(escaped), { ip: '140.240.27.69', detail: '中国 海南' })
assert.equal(parseIpipText('服务暂不可用'), null)

// api.ipify.org?format=json 与纯文本接口
assert.deepEqual(parseIpifyJson('{"ip":"140.240.27.69"}'), { ip: '140.240.27.69', detail: '' })
assert.deepEqual(parsePlainIp('140.240.27.69\n'), { ip: '140.240.27.69', detail: '' })
assert.deepEqual(parsePlainIp('2001:db8::1\n'), { ip: '2001:db8::1', detail: '' })
assert.equal(parseIpifyJson('{"ip":""}'), null)

// 兜底链：前一个接口挂了就用下一个
const jsonFetcher = (bodies) => async (url) => {
  const body = bodies[url]
  if (body === undefined) return { ok: false, status: 502, text: async () => '' }
  return { ok: true, status: 200, text: async () => body }
}
const good = await fetchPublicIp(jsonFetcher({ 'https://api.ipify.org?format=json': '{"ip":"203.0.113.7"}' }))
assert.equal(good.ok, true)
assert.equal(good.ip, '203.0.113.7')
assert.equal(good.source, 'ipify.org')
const firstWorks = await fetchPublicIp(jsonFetcher({ 'https://ipinfo.io/json': ipinfoBody }))
assert.equal(firstWorks.source, 'ipinfo.io')
const allFail = await fetchPublicIp(async () => {
  throw new Error('网络不通')
})
assert.equal(allFail.ok, false)
assert.ok(allFail.error.includes('ipinfo.io'))

console.log('ip lib check passed')