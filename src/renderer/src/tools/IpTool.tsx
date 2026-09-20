import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components'
import { ArrowSyncRegular, DismissRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { MONO_FONT, useToolStyles } from '@/components/toolStyles'
import {
  findContainment,
  formatCidrList,
  formatSummaryLines,
  formatTsv,
  formatUsableList,
  parseCidrList
} from '@/lib/ip'

// 与 main 的 PublicIpResult 结构一致。renderer 不允许 import src/main，所以本地声明一份
type PublicIpResult =
  { ok: true; ip: string; detail: string; source: string } | { ok: false; error: string }

const MATCH_BG = '#fff8c5'

const useStyles = makeStyles({
  table: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(120px, 1.1fr) 52px minmax(120px, 1.1fr) minmax(120px, 1.1fr) minmax(120px, 1.1fr) minmax(120px, 1.1fr) minmax(160px, 1.4fr) 76px minmax(150px, 1.4fr) minmax(96px, 1fr) minmax(130px, 1.1fr)',
    // 一行 11 列，窄窗口下横向滚动；输入框改成上方一整条就是为了让这里尽量宽
    minWidth: '1300px',
    fontFamily: MONO_FONT,
    fontSize: '12px',
    lineHeight: '20px',
    userSelect: 'text'
  },
  head: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '4px 8px',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  cell: {
    padding: '0 8px',
    minHeight: '20px',
    whiteSpace: 'nowrap'
  },
  strong: {
    color: tokens.colorNeutralForeground1
  },
  muted: {
    color: tokens.colorNeutralForeground4
  },
  matched: {
    backgroundColor: MATCH_BG
  },
  errors: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontFamily: MONO_FONT,
    fontSize: '12px'
  },
  publicIp: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    padding: '8px 12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2
  },
  publicIpValue: {
    fontFamily: MONO_FONT,
    fontSize: '14px',
    color: tokens.colorNeutralForeground1
  }
})

function IpTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [input, setInput] = useState('')
  const [target, setTarget] = useState('')
  const [publicIp, setPublicIp] = useState<PublicIpResult | null>(null)
  const [loading, setLoading] = useState(false)
  // 用的是 preload 桥接的 IPC；纯浏览器里没有 window.api
  const canQuery = typeof window.api?.getPublicIp === 'function'
  const queried = useRef(false)

  const load = async (): Promise<void> => {
    if (!canQuery || loading) return
    setLoading(true)
    try {
      setPublicIp(await window.api.getPublicIp())
    } catch (error) {
      setPublicIp({ ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  // 进页面自动查一次；StrictMode 下 effect 会跑两遍，用 ref 挡掉重复请求
  useEffect(() => {
    if (queried.current) return
    queried.current = true
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const report = useMemo(() => parseCidrList(input), [input])
  const containment = useMemo(() => findContainment(input, target), [input, target])
  const tsv = useMemo(() => formatTsv(report.entries), [report.entries])
  const cidrList = useMemo(() => formatCidrList(report.entries), [report.entries])
  const usableList = useMemo(() => formatUsableList(report.entries), [report.entries])
  const summary = useMemo(() => formatSummaryLines(report.entries), [report.entries])
  const matchedInputs = useMemo(
    () => new Set(containment.matches.map((match) => match.entry.input)),
    [containment.matches]
  )

  const hasTarget = target.trim() !== ''
  const usableMatch = containment.matches.some((match) => match.inUsable)

  return (
    <div className={shared.root}>
      <div className={styles.publicIp}>
        <Text size={200} className={shared.stats}>
          我的公网 IP
        </Text>
        {loading ? (
          <Spinner size="tiny" />
        ) : (
          <Text className={styles.publicIpValue}>{publicIp?.ok ? publicIp.ip : '—'}</Text>
        )}
        <Text size={200} className={shared.stats}>
          {publicIp?.ok
            ? [publicIp.detail, `来源 ${publicIp.source}`].filter(Boolean).join(' · ')
            : publicIp
              ? `查询失败：${publicIp.error}`
              : canQuery
                ? '查询中会走系统代理设置；挂代理时这里显示的是代理出口'
                : '当前环境没有 IPC 查询接口（需要桌面版）'}
        </Text>
        <div className={shared.spacer} />
        <CopyButton text={publicIp?.ok ? publicIp.ip : ''} label="复制 IP" tooltip="复制公网 IP" />
        <Button
          appearance="subtle"
          disabled={!publicIp?.ok}
          onClick={() => publicIp?.ok && setTarget(publicIp.ip)}
        >
          填入判断目标
        </Button>
        <Button
          appearance="subtle"
          disabled={!publicIp?.ok}
          onClick={() =>
            publicIp?.ok &&
            setInput((prev) =>
              prev.trim() === '' ? publicIp.ip : `${prev.trim()}\n${publicIp.ip}`
            )
          }
        >
          加到解析列表
        </Button>
        <Button
          appearance="subtle"
          icon={<ArrowSyncRegular />}
          disabled={!canQuery || loading}
          onClick={() => void load()}
        >
          重新查询
        </Button>
      </div>

      <div className={shared.toolbar}>
        <Input
          style={{ flex: 1, minWidth: '260px' }}
          contentBefore={
            <Text size={200} className={shared.stats}>
              包含判断
            </Text>
          }
          placeholder="填一个 IP，判断它落在下面的哪个网段（如 10.0.0.5 或 2001:db8::5）"
          value={target}
          onChange={(_, data) => setTarget(data.value)}
        />
        <Text size={200} className={shared.stats}>
          IPv6 没有广播地址概念，末地址就是网段内最后一个地址，可用数即网段总地址数
        </Text>
      </div>

      <div className={shared.actions}>
        <CopyButton
          label="复制全部（TSV）"
          text={tsv}
          appearance="primary"
          tooltip="含掩码、反掩码、整数、十六进制、二进制，可直接贴进表格"
        />
        <CopyButton label="复制网段" text={cidrList} tooltip="复制规范化后的 网络地址/前缀 列表" />
        <CopyButton label="复制可用范围" text={usableList} tooltip="复制每条的首地址 - 末地址" />
        <CopyButton
          label="复制摘要"
          text={summary}
          tooltip="网段 + 掩码 + 网络地址 + 可用范围 + 类型"
        />
        <div className={shared.spacer} />
        <Badge appearance="tint" color={report.entries.length > 0 ? 'brand' : 'informative'}>
          解析 {report.entries.length} 条
        </Badge>
        {report.errors.length > 0 && (
          <Badge appearance="tint" color="danger">
            失败 {report.errors.length} 条
          </Badge>
        )}
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => {
            setInput('')
            setTarget('')
          }}
          disabled={input === '' && target === ''}
        >
          清空
        </Button>
      </div>

      {hasTarget && !containment.error && containment.matches.length > 0 && (
        <MessageBar intent={usableMatch ? 'success' : 'warning'}>
          <MessageBarBody>
            {containment.target} 属于{' '}
            {containment.matches
              .map(
                (match) =>
                  `${match.entry.cidr}${match.inUsable ? '（可用主机地址）' : '（网络地址/广播地址，不是可用主机）'}`
              )
              .join('、')}
          </MessageBarBody>
        </MessageBar>
      )}
      {hasTarget && !containment.error && containment.matches.length === 0 && (
        <MessageBar>
          <MessageBarBody>{containment.target} 不在下面任何网段内。</MessageBarBody>
        </MessageBar>
      )}
      {containment.error && (
        <MessageBar intent="error">
          <MessageBarBody>包含判断的目标解析失败：{containment.error}</MessageBarBody>
        </MessageBar>
      )}

      {report.errors.length > 0 && (
        <MessageBar intent="error">
          <MessageBarBody>
            <div className={styles.errors}>
              {report.errors.map((item) => (
                <span key={item.input}>
                  {item.input} — {item.error}
                </span>
              ))}
            </div>
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={shared.pane}>
        <Text size={200} className={shared.paneTitle}>
          输入（每行一个 IP 或 CIDR，支持 IPv4/IPv6，可用逗号分隔）
        </Text>
        <Textarea
          className={shared.editor}
          resize="vertical"
          placeholder={
            '例如：\n192.168.1.10/24\n10.0.0.0/8\n172.16.5.1\n2001:db8::/64\n10.0.0.0/255.255.255.0'
          }
          value={input}
          onChange={(_, data) => setInput(data.value)}
        />
      </div>

      <div className={shared.pane}>
        <Text size={200} className={shared.paneTitle}>
          解析结果（表格左右可滚动）
        </Text>
        <div className={shared.panel}>
          {report.entries.length === 0 ? (
            <Text size={200} className={shared.hint}>
              上面贴入 IP 或网段，规范化网段、掩码、网络地址、可用范围与地址类型会显示在这里。
            </Text>
          ) : (
            <div className={styles.table}>
              {[
                '输入',
                '版本',
                '规范化 CIDR',
                '掩码',
                '网络地址',
                '末地址',
                '可用范围',
                '可用数',
                '类型',
                '整数',
                '十六进制'
              ].map((title) => (
                <span key={title} className={styles.head}>
                  {title}
                </span>
              ))}
              {report.entries.map((entry, index) => {
                const rowClass = mergeClasses(
                  styles.cell,
                  matchedInputs.has(entry.input) && styles.matched
                )
                return (
                  <div key={`${entry.input}#${index}`} style={{ display: 'contents' }}>
                    <span className={mergeClasses(rowClass, styles.muted)}>{entry.input}</span>
                    <span className={rowClass}>IPv{entry.version}</span>
                    <span className={mergeClasses(rowClass, styles.strong)}>{entry.cidr}</span>
                    <span className={rowClass}>{entry.netmask}</span>
                    <span className={rowClass}>{entry.network}</span>
                    <span className={rowClass}>{entry.last}</span>
                    <span className={rowClass}>
                      {entry.firstUsable} - {entry.lastUsable}
                    </span>
                    <span className={rowClass}>{entry.usable.toString()}</span>
                    <span className={rowClass}>{entry.scope}</span>
                    <span className={rowClass}>{entry.integer.toString()}</span>
                    <span className={rowClass}>{entry.hex}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IpTool
