import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Text,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import { ArrowSyncRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { useToolStyles } from '@/components/toolStyles'
import { copyText } from '@/lib/copy'
import {
  contrastReport,
  describeColor,
  harmonyPalettes,
  lightnessLadder,
  nearestNamedColor,
  parseColorInput,
  randomHex
} from '@/lib/color'

const DEFAULT_COLOR = '#0f6cbd'

const useStyles = makeStyles({
  pickerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap'
  },
  inputField: {
    minWidth: '220px',
    flex: 1
  },
  swatch: {
    width: '56px',
    height: '32px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  colorInput: {
    width: '56px',
    height: '32px',
    padding: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    flexShrink: 0
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  valueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '4px'
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '2px 4px',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1
  },
  valueLabel: {
    color: tokens.colorNeutralForeground3,
    width: '76px',
    flexShrink: 0
  },
  valueText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    userSelect: 'text'
  },
  swatchGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px'
  },
  swatchChip: {
    width: '64px',
    height: '48px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: '2px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: tokens.colorNeutralForeground3
  },
  paletteRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  ratio: {
    fontFamily: 'var(--font-mono)',
    userSelect: 'text'
  }
})

interface SwatchProps {
  hex: string
  label: string
  className: string
}

function Swatch({ hex, label, className }: SwatchProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className={className}
      style={{ backgroundColor: hex, color: copied ? undefined : 'transparent' }}
      title={`${label} ${hex}（点击复制）`}
      aria-label={`${label} ${hex}`}
      onClick={async () => {
        const ok = await copyText(hex)
        if (!ok) return
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? '已复制' : ''}
    </button>
  )
}

function ColorTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [input, setInput] = useState(DEFAULT_COLOR)
  const [background, setBackground] = useState('#ffffff')

  const parsed = useMemo(() => parseColorInput(input), [input])
  const entries = useMemo(() => (parsed.ok ? describeColor(parsed.color) : []), [parsed])
  const report = useMemo(
    () => (parsed.ok ? contrastReport(parsed.color, background) : null),
    [parsed, background]
  )
  const ladder = useMemo(() => (parsed.ok ? lightnessLadder(parsed.color, 10) : []), [parsed])
  const palettes = useMemo(() => (parsed.ok ? harmonyPalettes(parsed.color) : []), [parsed])
  const named = useMemo(() => (parsed.ok ? nearestNamedColor(parsed.color) : null), [parsed])
  const hexValue = entries.find((entry) => entry.label === 'HEX')?.value ?? DEFAULT_COLOR

  return (
    <div className={shared.root}>
      <div className={styles.pickerRow}>
        <Field label="颜色（hex / rgb / hsl / 颜色名都能识别）" className={styles.inputField}>
          <Input
            value={input}
            onChange={(_, data) => setInput(data.value)}
            contentBefore={
              <span
                className={styles.swatch}
                style={{ backgroundColor: parsed.ok ? hexValue : 'transparent' }}
              />
            }
          />
        </Field>
        <Field label="调色板取色">
          <input
            type="color"
            className={styles.colorInput}
            aria-label="系统取色器"
            value={/^#[0-9a-fA-F]{6}$/.test(hexValue) ? hexValue : DEFAULT_COLOR}
            onChange={(event) => setInput(event.target.value)}
          />
        </Field>
        <Button
          appearance="secondary"
          icon={<ArrowSyncRegular />}
          onClick={() => setInput(randomHex())}
        >
          随机颜色
        </Button>
      </div>

      {!parsed.ok ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            无法识别这个颜色，试试 #0f6cbd、rgb(15 108 189)、hsl(205 85% 40%) 或 red。
          </MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.pickerRow}>
          <Badge appearance="tint" color="informative">
            最近的颜色名：{named?.name}（{named?.hex}）
          </Badge>
          <Badge appearance="tint">色差 ΔE {named?.distance}</Badge>
          <Badge appearance="tint">相对亮度 {report?.luminance}</Badge>
          <div className={shared.spacer} />
          <CopyButton label="复制 HEX" text={hexValue} />
        </div>
      )}

      {parsed.ok && (
        <>
          <div className={styles.section}>
            <Text size={300} weight="semibold">
              各色彩空间
            </Text>
            <div className={styles.valueGrid}>
              {entries.map((entry) => (
                <div key={entry.label} className={styles.valueRow}>
                  <Text size={200} className={styles.valueLabel}>
                    {entry.label}
                  </Text>
                  <Text size={200} className={styles.valueText} title={entry.value}>
                    {entry.value}
                  </Text>
                  <CopyButton
                    label=""
                    text={entry.value}
                    tooltip={`复制 ${entry.label}`}
                    size="small"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <Text size={300} weight="semibold">
              对比度（WCAG）
            </Text>
            <div className={styles.pickerRow}>
              <Field label="背景色">
                <Input
                  value={background}
                  onChange={(_, data) => setBackground(data.value)}
                  style={{ minWidth: '160px' }}
                />
              </Field>
              <Text size={200} className={styles.ratio}>
                与背景 {report?.onBackground}:1 · 与黑 {report?.onBlack}:1 · 与白 {report?.onWhite}
                :1
              </Text>
              <Badge
                appearance="tint"
                color={report?.levels.normal.aa ? 'success' : 'danger'}
                size="large"
              >
                正文 AA {report?.levels.normal.aa ? '通过' : '不通过'}
              </Badge>
              <Badge
                appearance="tint"
                color={report?.levels.normal.aaa ? 'success' : 'warning'}
                size="large"
              >
                正文 AAA {report?.levels.normal.aaa ? '通过' : '不通过'}
              </Badge>
              <Badge
                appearance="tint"
                color={report?.levels.large.aa ? 'success' : 'danger'}
                size="large"
              >
                大字 AA {report?.levels.large.aa ? '通过' : '不通过'}
              </Badge>
            </div>
          </div>

          <div className={styles.section}>
            <Text size={300} weight="semibold">
              明暗阶梯（点击色块复制）
            </Text>
            <div className={styles.swatchGrid}>
              {ladder.map((step) => (
                <Swatch
                  key={step.label}
                  hex={step.hex}
                  label={step.label}
                  className={styles.swatchChip}
                />
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <Text size={300} weight="semibold">
              配色方案（点击色块复制）
            </Text>
            {palettes.map((palette) => (
              <div key={palette.title} className={styles.paletteRow}>
                <Text size={200} className={shared.stats}>
                  {palette.title} · {palette.hint}
                </Text>
                <div className={styles.swatchGrid}>
                  {palette.swatches.map((swatch) => (
                    <Swatch
                      key={`${palette.title}-${swatch.label}`}
                      hex={swatch.hex}
                      label={`${palette.title} ${swatch.label}`}
                      className={styles.swatchChip}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ColorTool
