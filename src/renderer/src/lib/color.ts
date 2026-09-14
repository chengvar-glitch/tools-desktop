import {
  colorsNamed,
  converter,
  differenceEuclidean,
  formatHex,
  formatHex8,
  formatRgb,
  nearest,
  parse,
  random,
  toGamut,
  wcagContrast,
  wcagLuminance,
  type Color
} from 'culori'

export interface ColorEntry {
  label: string
  value: string
}

export interface ContrastReport {
  luminance: number
  onBlack: number
  onWhite: number
  onBackground: number
  background: string
  levels: { normal: WcagLevel; large: WcagLevel }
}

export interface WcagLevel {
  aa: boolean
  aaa: boolean
}

export interface Palette {
  title: string
  hint: string
  swatches: { label: string; hex: string }[]
}

const toRgb = converter('rgb')
const toHsl = converter('hsl')
const toHsv = converter('hsv')
const toHwb = converter('hwb')
const toLab = converter('lab')
const toLch = converter('lch')
const toOklab = converter('oklab')
const toOklch = converter('oklch')

const round = (value: number | undefined, digits = 2): number => {
  if (value === undefined || Number.isNaN(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function parseColorInput(input: string): { ok: true; color: Color } | { ok: false } {
  const trimmed = input.trim()
  if (trimmed === '') return { ok: false }
  const parsed = parse(trimmed)
  if (!parsed) return { ok: false }
  return { ok: true, color: parsed }
}

export function describeColor(color: Color): ColorEntry[] {
  const rgb = toRgb(color)
  const hsl = toHsl(color)
  const hsv = toHsv(color)
  const hwb = toHwb(color)
  const lab = toLab(color)
  const lch = toLch(color)
  const oklab = toOklab(color)
  const oklch = toOklch(color)
  const alpha = round(rgb.alpha ?? 1, 3)
  const alphaSuffix = alpha < 1 ? ` / ${alpha}` : ''

  return [
    { label: 'HEX', value: formatHex(color).toUpperCase() },
    { label: 'HEX8', value: formatHex8(color).toUpperCase() },
    { label: 'RGB', value: formatRgb(color) },
    {
      label: 'CSS rgb()',
      value: `rgb(${Math.round((rgb.r ?? 0) * 255)} ${Math.round((rgb.g ?? 0) * 255)} ${Math.round(
        (rgb.b ?? 0) * 255
      )}${alphaSuffix})`
    },
    {
      label: 'HSL',
      value: `hsl(${round(hsl.h, 1)} ${round((hsl.s ?? 0) * 100, 1)}% ${round((hsl.l ?? 0) * 100, 1)}%)`
    },
    {
      label: 'HSV',
      value: `hsv(${round(hsv.h, 1)} ${round((hsv.s ?? 0) * 100, 1)}% ${round((hsv.v ?? 0) * 100, 1)}%)`
    },
    {
      label: 'HWB',
      value: `hwb(${round(hwb.h, 1)} ${round((hwb.w ?? 0) * 100, 1)}% ${round((hwb.b ?? 0) * 100, 1)}%)`
    },
    { label: 'LAB', value: `lab(${round(lab.l)}% ${round(lab.a)} ${round(lab.b)})` },
    { label: 'LCH', value: `lch(${round(lch.l)}% ${round(lch.c)} ${round(lch.h, 1)})` },
    {
      label: 'OKLAB',
      value: `oklab(${round(oklab.l, 4)} ${round(oklab.a, 4)} ${round(oklab.b, 4)})`
    },
    {
      label: 'OKLCH',
      value: `oklch(${round(oklch.l, 4)} ${round(oklch.c, 4)} ${round(oklch.h, 1)})`
    }
  ]
}

export function wcagLevels(ratio: number): { normal: WcagLevel; large: WcagLevel } {
  return {
    normal: { aa: ratio >= 4.5, aaa: ratio >= 7 },
    large: { aa: ratio >= 3, aaa: ratio >= 4.5 }
  }
}

export function contrastReport(color: Color, backgroundInput: string): ContrastReport {
  const background = parseColorInput(backgroundInput)
  const backgroundColor = background.ok ? background.color : parse('#ffffff')!
  const ratio = wcagContrast(color, backgroundColor)
  return {
    luminance: round(wcagLuminance(color), 4),
    onBlack: round(wcagContrast(color, '#000000'), 2),
    onWhite: round(wcagContrast(color, '#ffffff'), 2),
    onBackground: round(ratio, 2),
    background: formatHex(backgroundColor).toUpperCase(),
    levels: wcagLevels(ratio)
  }
}

// 在 OKLCH 里按 L 均匀插值，色相和彩度尽量保留，最后再压回 sRGB 色域
function withLightness(color: Color, lightness: number): Color {
  const oklch = toOklch(color)
  return toGamut(
    'rgb',
    'oklch'
  )({ mode: 'oklch', l: lightness, c: oklch.c, h: oklch.h, alpha: oklch.alpha })
}

function rotateHue(color: Color, degrees: number): Color {
  const oklch = toOklch(color)
  const hue = ((oklch.h ?? 0) + degrees + 360) % 360
  return toGamut(
    'rgb',
    'oklch'
  )({ mode: 'oklch', l: oklch.l, c: oklch.c, h: hue, alpha: oklch.alpha })
}

export function lightnessLadder(color: Color, steps = 10): { label: string; hex: string }[] {
  const base = toOklch(color)
  const baseLightness = base.l
  const tints: { label: string; hex: string }[] = []
  const shades: { label: string; hex: string }[] = []

  for (let i = 1; i <= steps; i++) {
    const ratio = i / (steps + 1)
    // 本色往白（tint）和往黑（shade）各走 steps 步
    tints.push({
      label: `Tint ${i}`,
      hex: formatHex(withLightness(color, baseLightness + (1 - baseLightness) * ratio))
    })
    shades.push({
      label: `Shade ${i}`,
      hex: formatHex(withLightness(color, baseLightness * (1 - ratio)))
    })
  }

  // 展示顺序从最亮到最暗
  return [...tints.reverse(), { label: 'Base', hex: formatHex(color) }, ...shades]
}

export function harmonyPalettes(color: Color): Palette[] {
  const rotations: { title: string; hint: string; angles: number[] }[] = [
    { title: '互补色', hint: '色环对面，对比最强', angles: [180] },
    { title: '分裂互补', hint: '互补色两侧，对比强但更柔和', angles: [150, 210] },
    { title: '类似色', hint: '相邻色相，整体协调', angles: [-30, 30] },
    { title: '三角配色', hint: '色环三等分，色彩丰富', angles: [120, 240] },
    { title: '四角配色', hint: '两对互补色，适合多色场景', angles: [90, 180, 270] }
  ]

  return rotations.map((rotation) => ({
    title: rotation.title,
    hint: rotation.hint,
    swatches: [
      { label: '本色', hex: formatHex(color) },
      ...rotation.angles.map((angle) => ({
        label: `${angle > 0 ? '+' : ''}${angle}°`,
        hex: formatHex(rotateHue(color, angle))
      }))
    ]
  }))
}

// culori 的 colorsNamed 是 24 位整数（如 0xF0F8FF），不是 hex 字符串
function namedColorHex(value: number | string): string {
  if (typeof value === 'string') return value
  return `#${value.toString(16).padStart(6, '0')}`
}

export function nearestNamedColor(color: Color): { name: string; hex: string; distance: number } {
  const metric = differenceEuclidean('lab')
  const palette = Object.entries(colorsNamed).map(([name, value]) => ({
    name,
    hex: namedColorHex(value)
  }))
  const findNearest = nearest(palette, metric, (entry) => entry.hex)
  const [closest] = findNearest(color, 1)
  if (!closest) return { name: '未命名', hex: formatHex(color).toUpperCase(), distance: 0 }

  return {
    name: closest.name,
    hex: closest.hex.toUpperCase(),
    distance: round(metric(color, closest.hex), 2)
  }
}

export function randomHex(): string {
  return formatHex(random()).toUpperCase()
}
