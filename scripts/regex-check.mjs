// 断言式自检：node scripts/regex-check.mjs（Node 20+ 能直接跑 .ts，无需构建）
import assert from 'node:assert/strict'
import {
  runRegex,
  replaceWithRegex,
  highlightMatches,
  lineColumnAt,
  buildLineIndex,
  formatMatchList,
  formatMatchValues,
  flagString,
  DEFAULT_OPTIONS,
  MAX_MATCHES
} from '../src/renderer/src/lib/regex.ts'

const o = (over = {}) => ({ ...DEFAULT_OPTIONS, ...over })

// 基础匹配
let r = runRegex('\\d+', 'a1 bb 22 ccc 333', o())
assert.equal(r.matches.length, 3)
assert.deepEqual(
  r.matches.map((m) => m.value),
  ['1', '22', '333']
)
assert.equal(r.matches[1].index, 6)
assert.equal(r.matches[1].end, 8)
assert.equal(r.error, null)

// 空 pattern / 空输入
assert.deepEqual(runRegex('', 'abc', o()).matches, [])
assert.deepEqual(runRegex('a', '', o()).matches, [])
assert.equal(runRegex('', 'abc', o()).error, null)

// 非法 pattern 报错
r = runRegex('(', 'abc', o())
assert.ok(r.error && r.matches.length === 0)

// flags
assert.equal(
  flagString(o({ ignoreCase: true, multiline: true, dotAll: true, unicode: true })),
  'imsu'
)
assert.equal(runRegex('ABC', 'abc', o()).matches.length, 0)
assert.equal(runRegex('ABC', 'abc', o({ ignoreCase: true })).matches.length, 1)
assert.equal(runRegex('^b', 'a\nb', o()).matches.length, 0)
assert.equal(runRegex('^b', 'a\nb', o({ multiline: true })).matches.length, 1)
assert.equal(runRegex('a.b', 'a\nb', o()).matches.length, 0)
assert.equal(runRegex('a.b', 'a\nb', o({ dotAll: true })).matches.length, 1)

// 分组：编号 + 命名 + 未参与匹配的分组
r = runRegex('(?<user>[\\w.]+)@([\\w.]+)', 'mail zhangsan@example.com x', o())
assert.equal(r.matches.length, 1)
assert.deepEqual(r.matches[0].named, { user: 'zhangsan' })
assert.equal(r.matches[0].groups[1].value, 'example.com')
r = runRegex('(a)|(b)', 'ab', o())
assert.equal(r.matches[0].groups[0].value, 'a')
assert.equal(r.matches[0].groups[1].value, undefined)
assert.equal(r.matches[0].groups[1].start, -1)

// 零宽匹配不卡死
r = runRegex('\\b', 'a b c', o())
assert.equal(r.matches.length, 6)
assert.ok(r.matches.every((m) => m.value === ''))

// 上限截断
r = runRegex('a', 'a'.repeat(MAX_MATCHES + 50), o())
assert.equal(r.matches.length, MAX_MATCHES)
assert.equal(r.truncated, true)
assert.equal(runRegex('a', 'aaa', o()).truncated, false)

// 替换：$1 / $<name> / $& 交给引擎展开，字面 $ 也不能炸
assert.equal(replaceWithRegex('(\\d+)', 'a1b22', '$1!', o()).text, 'a1!b22!')
assert.equal(replaceWithRegex('(?<n>\\d+)', 'a1', '[$<n>]', o()).text, 'a[1]')
assert.equal(replaceWithRegex('\\d', 'a1b2', '<$&>', o()).text, 'a<1>b<2>')
assert.equal(replaceWithRegex('x', 'abc', '$', o()).text, 'abc')
assert.equal(replaceWithRegex('a', 'aaa', '', o()).text, '')
assert.equal(replaceWithRegex('', 'abc', 'x', o()).text, 'abc')
assert.ok(replaceWithRegex('(', 'abc', 'x', o()).error)

// 高亮分段能还原原文
const hl = (p, t, ov) => highlightMatches(t, runRegex(p, t, o(ov)).matches)
const joined = (segs) => segs.map((s) => s.text).join('')
const marked = (segs) => segs.filter((s) => s.matched).map((s) => s.text)
assert.equal(joined(hl('\\d+', 'a1 bb 22 c')), 'a1 bb 22 c')
assert.deepEqual(marked(hl('\\d+', 'a1 bb 22 c')), ['1', '22'])
assert.deepEqual(marked(hl('\\b', 'a b')), [])
assert.equal(joined(hl('\\b', 'a b')), 'a b')
assert.deepEqual(marked(hl('\\d', '')), [])

// 行列换算
assert.deepEqual(lineColumnAt(buildLineIndex('ab\ncd\ne'), 0), { line: 1, column: 1 })
assert.deepEqual(lineColumnAt(buildLineIndex('ab\ncd\ne'), 3), { line: 2, column: 1 })
assert.deepEqual(lineColumnAt(buildLineIndex('ab\ncd\ne'), 6), { line: 3, column: 1 })
assert.deepEqual(lineColumnAt(buildLineIndex('ab\ncd\ne'), 7), { line: 3, column: 2 })

// 复制文本
assert.equal(formatMatchValues(runRegex('\\d+', 'a1b22', o()).matches), '1\n22')
assert.equal(formatMatchList('ab\ncd 7', runRegex('\\d', 'ab\ncd 7', o()).matches), '#1 L2:4 "7"')
assert.equal(formatMatchList('abc', runRegex('z', 'abc', o()).matches), '')
const named = formatMatchList(
  'zhangsan@example.com',
  runRegex('(?<user>[\\w.]+)@([\\w.]+)', 'zhangsan@example.com', o()).matches
)
assert.ok(named.includes('<user> zhangsan'))
assert.ok(named.includes('$2 example.com'))
assert.ok(!named.includes('$1 zhangsan'))

console.log('regex lib check passed')
