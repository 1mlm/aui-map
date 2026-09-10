// three.js's Color.setStyle doesn't understand oklch() (only hex/rgb/hsl/named), but tagColor.ts's
// whole palette is oklch strings. Round-tripping through the browser (canvas fillStyle, computed
// style) looked like the easy way to let it do the oklch->rgb math, but modern Chrome can echo the
// oklch string straight back unconverted in both places — so this does the conversion itself,
// via the standard OKLab/OKLCH -> linear sRGB matrices (Björn Ottosson's oklab.js reference).

const OKLCH_PATTERN = /oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/

function oklabToLinearSrgb(lightness: number, a: number, b: number) {
  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
  const s_ = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

function linearToGammaChannel(value: number) {
  const clamped = Math.min(1, Math.max(0, value))
  const gamma =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.round(gamma * 255)
    .toString(16)
    .padStart(2, "0")
}

export function oklchToHex(oklch: string): string {
  const match = oklch.match(OKLCH_PATTERN)
  if (!match) return "#888888"
  const [, lightnessRaw, chroma, hueDeg] = match
  // tailwind's oklch strings write lightness as a bare 0-1 fraction, not a percentage
  const lightness = Number(lightnessRaw)
  const hueRad = (Number(hueDeg) * Math.PI) / 180
  const a = Number(chroma) * Math.cos(hueRad)
  const b = Number(chroma) * Math.sin(hueRad)
  const { r, g, b: blue } = oklabToLinearSrgb(lightness, a, b)
  return `#${linearToGammaChannel(r)}${linearToGammaChannel(g)}${linearToGammaChannel(blue)}`
}
