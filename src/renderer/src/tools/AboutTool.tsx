import { Text, makeStyles, tokens } from '@fluentui/react-components'
import { ShieldKeyholeRegular } from '@fluentui/react-icons'
import { useToolStyles } from '@/components/toolStyles'

const useStyles = makeStyles({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '520px',
    padding: '24px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  appIcon: {
    display: 'grid',
    placeItems: 'center',
    width: '48px',
    height: '48px',
    fontSize: '28px',
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusLarge
  },
  version: {
    display: 'inline-block',
    padding: '1px 8px',
    fontSize: '12px',
    color: tokens.colorBrandForeground2,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: '9999px'
  },
  desc: {
    color: tokens.colorNeutralForeground2
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  infoRow: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px'
  },
  infoLabel: {
    minWidth: '96px',
    color: tokens.colorNeutralForeground3
  },
  infoValue: {
    fontFamily: 'var(--font-mono)',
    color: tokens.colorNeutralForeground1
  }
})

function AboutTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const versions = window.electron?.process?.versions
  const rows: { label: string; value: string }[] = [
    { label: 'Electron', value: versions?.electron ?? '—' },
    { label: 'Chromium', value: versions?.chrome ?? '—' },
    { label: 'Node.js', value: versions?.node ?? '—' },
    { label: '系统平台', value: window.electron?.process?.platform ?? navigator.platform }
  ]

  return (
    <div className={shared.root}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <div className={styles.appIcon}>
            <ShieldKeyholeRegular />
          </div>
          <div>
            <Text size={500} weight="semibold" block>
              工具箱 <span className={styles.version}>v{__APP_VERSION__}</span>
            </Text>
            <Text size={200} className={styles.desc}>
              tools-desktop · 个人工具集合桌面版
            </Text>
          </div>
        </div>
        <Text size={300} className={styles.desc}>
          日常开发杂活的小工具集合：文本 Diff、排序去重、单号处理、JSON、颜色、密码、哈希编码等，
          数据全部在本地处理，不上传任何内容。
        </Text>
        <div className={styles.infoList}>
          {rows.map((row) => (
            <div key={row.label} className={styles.infoRow}>
              <span className={styles.infoLabel}>{row.label}</span>
              <span className={styles.infoValue}>{row.value}</span>
            </div>
          ))}
        </div>
        <Text size={200} className={styles.desc}>
          基于 Electron + React + Fluent UI 构建。
        </Text>
      </div>
    </div>
  )
}

export default AboutTool
