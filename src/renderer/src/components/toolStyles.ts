import { makeStyles, tokens } from '@fluentui/react-components'

// 等宽字体走 base.css 里的 --font-mono，与 nexashell 的字体栈一致
export const MONO_FONT = 'var(--font-mono)'

export const useToolStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: '2px'
  },
  panes: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    minHeight: 0,
    flex: 1
  },
  panesFixed: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
    minHeight: 0
  },
  paneTitle: {
    color: tokens.colorNeutralForeground3
  },
  // 放在 Textarea 的 textarea slot 上，让内部输入框撑满外层容器
  monoFill: {
    fontFamily: MONO_FONT,
    fontSize: '12px',
    lineHeight: '18px',
    height: '100%',
    boxSizing: 'border-box'
  },
  fill: {
    flex: 1,
    minHeight: '160px'
  },
  editor: {
    fontFamily: MONO_FONT,
    fontSize: '12px',
    lineHeight: '18px',
    minHeight: '120px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  spacer: {
    flex: 1
  },
  stats: {
    color: tokens.colorNeutralForeground3
  },
  statsStrong: {
    color: tokens.colorNeutralForeground1
  },
  panel: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'auto',
    flex: 1,
    minHeight: '240px'
  },
  hint: {
    padding: '16px',
    color: tokens.colorNeutralForeground3
  },
  note: {
    padding: '0 16px 12px',
    color: tokens.colorNeutralForeground3
  }
})
