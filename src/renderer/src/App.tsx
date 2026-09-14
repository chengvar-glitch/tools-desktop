import { useState } from 'react'
import {
  Button,
  TabList,
  Tab,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens
} from '@fluentui/react-components'
import {
  ArrowSortRegular,
  BracesRegular,
  ColorRegular,
  DocumentTextRegular,
  KeyRegular,
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

// macOS 的 hiddenInset 会把红绿灯画在标题栏左上角，按钮要给它让出位置
const COLLAPSED_WIDTH = '56px'
const TRAFFIC_LIGHT_INSET = 84
const PLAIN_INSET = 12
const isMac = window.electron?.process?.platform === 'darwin'

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
  { id: 'regex', label: '正则测试', icon: <SearchRegular />, desc: '正则表达式实时匹配测试。' },
  { id: 'about', label: '关于', icon: <SettingsRegular />, desc: '个人工具集合桌面版。' }
]

const useStyles = makeStyles({
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh'
  },
  titlebarButton: {
    flexShrink: 0
  },
  row: {
    display: 'flex',
    flex: 1,
    minHeight: 0
  },
  sidebar: {
    width: '200px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 12px',
    backgroundColor: 'var(--color-chrome)',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowY: 'auto',
    overflowX: 'hidden',
    userSelect: 'none'
  },
  sidebarCollapsed: {
    width: COLLAPSED_WIDTH,
    padding: '16px 4px',
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
    padding: '16px 20px 20px',
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

  return (
    <div className={styles.app}>
      <header
        className="titlebar"
        style={{ paddingLeft: isMac ? TRAFFIC_LIGHT_INSET : PLAIN_INSET }}
      >
        <Tooltip content={toggleLabel} relationship="label">
          <Button
            className="titlebar-action"
            appearance="subtle"
            size="small"
            icon={collapsed ? <PanelLeftExpandRegular /> : <PanelLeftContractRegular />}
            aria-label={toggleLabel}
            onClick={() => setCollapsed((value) => !value)}
          />
        </Tooltip>
      </header>
      <div className={styles.row}>
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
    </div>
  )
}

export default App
