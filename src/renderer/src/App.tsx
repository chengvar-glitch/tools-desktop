import { useState } from 'react'
import {
  Button,
  TabList,
  Tab,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens
} from '@fluentui/react-components'
import {
  ArrowSortRegular,
  BracesRegular,
  ColorRegular,
  DocumentTextRegular,
  KeyRegular,
  NetworkCheckRegular,
  NumberSymbolRegular,
  PanelLeftContractRegular,
  PanelLeftExpandRegular,
  SearchRegular,
  SettingsRegular,
  ShieldKeyholeRegular
} from '@fluentui/react-icons'
import DiffTool from '@/tools/DiffTool'
import SortTool from '@/tools/SortTool'
import OrderTool from '@/tools/OrderTool'
import JsonTool from '@/tools/JsonTool'
import ColorTool from '@/tools/ColorTool'
import PasswordTool from '@/tools/PasswordTool'
import HashTool from '@/tools/HashTool'
import RegexTool from '@/tools/RegexTool'
import IpTool from '@/tools/IpTool'
import AboutTool from '@/tools/AboutTool'

// macOS 的 hiddenInset 会把红绿灯画在窗口左上角，侧边栏顶部要给它让位
const COLLAPSED_WIDTH = '56px'
const TOP_STRIP_HEIGHT = '40px'
const TRAFFIC_LIGHT_INSET = 84
const isMac = window.electron?.process?.platform === 'darwin'
const isLinux = window.electron?.process?.platform === 'linux'

interface Tool {
  id: string
  label: string
  icon: React.JSX.Element
  desc: string
}

const tools: Tool[] = [
  {
    id: 'diff',
    label: '文本 Diff',
    icon: <DocumentTextRegular />,
    desc: '左右分栏对比两份文本，可一键复制新增/删除/差异内容。'
  },
  {
    id: 'sort',
    label: '排序去重',
    icon: <ArrowSortRegular />,
    desc: '多规则排序与去重，可复制结果、重复项和被去掉的重复行。'
  },
  {
    id: 'order',
    label: '单号处理',
    icon: <NumberSymbolRegular />,
    desc: '批量提取纯数字单号，复制成引号包裹、逗号分隔或 SQL IN。'
  },
  {
    id: 'json',
    label: 'JSON 工具',
    icon: <BracesRegular />,
    desc: '格式化、压缩、校验（带行列定位）、转义、JSON ⇄ YAML、生成 TS 接口。'
  },
  {
    id: 'color',
    label: '颜色工具',
    icon: <ColorRegular />,
    desc: '多色彩空间转换、WCAG 对比度检查、明暗阶梯与配色方案。'
  },
  {
    id: 'password',
    label: '密码生成',
    icon: <KeyRegular />,
    desc: '批量生成强随机密码、估算强度与破解时间、生成 UUID / 随机串。'
  },
  {
    id: 'hash',
    label: '哈希与编码',
    icon: <ShieldKeyholeRegular />,
    desc: 'MD5 / SHA 系列哈希计算，Base64 编解码（UTF-8 安全）。'
  },
  {
    id: 'regex',
    label: '正则测试',
    icon: <SearchRegular />,
    desc: '正则实时匹配、分组明细与高亮，支持替换预览。'
  },
  {
    id: 'ip',
    label: 'IP 工具',
    icon: <NetworkCheckRegular />,
    desc: 'IP/CIDR 解析：掩码、网络与广播地址、可用范围、地址类型，含包含判断。'
  },
  { id: 'about', label: '关于', icon: <SettingsRegular />, desc: '个人工具集合桌面版。' }
]

const useStyles = makeStyles({
  app: {
    position: 'relative',
    display: 'flex',
    height: '100vh',
    overflow: 'hidden'
  },
  // 顶部 40px 是唯一的拖拽条，跨侧边栏与内容区浮在最上层。
  // 所有控件都必须放进它里面：no-drag 只有在拖拽区的后代上才会被正确扣出，
  // 与它兄弟关系又重叠的控件会被拖拽区吃掉（真实鼠标点击无反应）。
  topStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_STRIP_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    zIndex: 2
  },
  toggle: {
    // macOS 的红绿灯占住左上角，按钮恒定贴在其右侧一格；其他平台顶到左上角。
    // 位置只由平台决定，折叠/展开时都不移动。
    marginLeft: isMac ? `${TRAFFIC_LIGHT_INSET}px` : '8px',
    display: 'flex',
    alignItems: 'center'
  },
  winControls: {
    marginLeft: 'auto',
    display: 'flex',
    alignSelf: 'stretch'
  },
  winControl: {
    width: '46px',
    display: 'grid',
    placeItems: 'center',
    border: 'none',
    padding: '0',
    background: 'transparent',
    color: tokens.colorNeutralForeground2,
    cursor: 'default',
    ...shorthands.borderRadius('0'),
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1
    },
    ':active': {
      backgroundColor: tokens.colorNeutralBackground1Pressed
    }
  },
  winClose: {
    ':hover': {
      backgroundColor: '#e81123',
      color: '#ffffff'
    },
    ':active': {
      backgroundColor: '#f1707a',
      color: '#ffffff'
    }
  },
  sidebar: {
    width: '200px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    // 顶部让出拖拽条的高度（拖拽条是浮在上层的绝对定位元素）
    padding: '40px 12px 16px',
    backgroundColor: 'var(--color-chrome)',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowY: 'auto',
    overflowX: 'hidden',
    userSelect: 'none'
  },
  sidebarCollapsed: {
    width: COLLAPSED_WIDTH,
    padding: '40px 4px 16px',
    alignItems: 'stretch'
  },
  sidebarTitle: {
    paddingLeft: '8px',
    whiteSpace: 'nowrap'
  },
  rail: {
    gap: '4px'
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    // 顶部让出拖拽条的高度
    padding: '44px 20px 20px',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flexShrink: 0
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0
  },
  placeholder: {
    padding: '16px',
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground3
  }
})

function ToolBody({ id }: { id: string }): React.JSX.Element {
  const styles = useStyles()

  if (id === 'diff') return <DiffTool />
  if (id === 'sort') return <SortTool />
  if (id === 'order') return <OrderTool />
  if (id === 'json') return <JsonTool />
  if (id === 'color') return <ColorTool />
  if (id === 'password') return <PasswordTool />
  if (id === 'hash') return <HashTool />
  if (id === 'regex') return <RegexTool />
  if (id === 'ip') return <IpTool />
  if (id === 'about') return <AboutTool />

  return (
    <div className={styles.placeholder}>
      <Text size={300}>该工具还没有实现，先留个位置。</Text>
    </div>
  )
}

function App(): React.JSX.Element {
  const styles = useStyles()
  const [selected, setSelected] = useState<string>(tools[0].id)
  const [collapsed, setCollapsed] = useState(false)
  const tool = tools.find((t) => t.id === selected) ?? tools[0]
  const toggleLabel = collapsed ? '展开菜单栏' : '收起菜单栏'
  const toggleMaximize = isLinux ? () => window.api.toggleMaximizeWindow() : undefined

  return (
    <div className={styles.app}>
      <div
        className={mergeClasses('titlebar-drag', styles.topStrip)}
        onDoubleClick={toggleMaximize}
      >
        <div
          className={mergeClasses('titlebar-action', styles.toggle)}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Tooltip content={toggleLabel} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={collapsed ? <PanelLeftExpandRegular /> : <PanelLeftContractRegular />}
              aria-label={toggleLabel}
              onClick={() => setCollapsed((value) => !value)}
            />
          </Tooltip>
        </div>
        {isLinux && (
          <div
            className={mergeClasses('titlebar-action', styles.winControls)}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.winControl}
              aria-label="最小化"
              onClick={() => window.api.minimizeWindow()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.winControl}
              aria-label="最大化/还原"
              onClick={() => window.api.toggleMaximizeWindow()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className={mergeClasses(styles.winControl, styles.winClose)}
              aria-label="关闭"
              onClick={() => window.api.closeWindow()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <aside className={mergeClasses(styles.sidebar, collapsed && styles.sidebarCollapsed)}>
        {!collapsed && (
          <Text size={400} weight="semibold" className={styles.sidebarTitle} block>
            工具箱
          </Text>
        )}
        <TabList
          vertical
          className={collapsed ? styles.rail : undefined}
          selectedValue={selected}
          onTabSelect={(_, d) => setSelected(String(d.value))}
        >
          {tools.map((t) => {
            const tab = (
              <Tab key={t.id} value={t.id} icon={t.icon} aria-label={t.label}>
                {collapsed ? null : t.label}
              </Tab>
            )
            return collapsed ? (
              <Tooltip key={t.id} content={t.label} relationship="label">
                {tab}
              </Tooltip>
            ) : (
              tab
            )
          })}
        </TabList>
      </aside>
      <main className={styles.content}>
        <div className={styles.header}>
          <Text size={500} weight="semibold">
            {tool.label}
          </Text>
          <Text size={200}>{tool.desc}</Text>
        </div>
        <div className={styles.body}>
          <ToolBody id={tool.id} />
        </div>
      </main>
    </div>
  )
}

export default App
