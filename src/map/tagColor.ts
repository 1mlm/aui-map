import colors from "tailwindcss/colors"

// tailwind's palette also exports flat keywords (inherit, current, transparent, black, white) that
// have no shade scale, so they're filtered out of the tag colors
type ShadeScales = {
  [Name in keyof typeof colors as (typeof colors)[Name] extends string
    ? never
    : Name]: (typeof colors)[Name]
}

// tailwind ships nine near-identical neutral-ish families (slate, gray, zinc, neutral, stone,
// mauve, olive, mist, taupe) that are indistinguishable at a glance — collapsed into five flat,
// clearly distinct grayscale steps instead. Built from real tailwind neutral values (just
// reindexed along the scale), not invented numbers
const GRAYSCALE_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const

function grayscale(centerIndex: number) {
  return Object.fromEntries(
    GRAYSCALE_STEPS.map((step, i) => {
      const sourceIndex = Math.min(
        GRAYSCALE_STEPS.length - 1,
        Math.max(0, i - 5 + centerIndex),
      )
      return [step, colors.neutral[GRAYSCALE_STEPS[sourceIndex]]]
    }),
  ) as (typeof colors)["neutral"]
}

const customColors = {
  veryWhite: grayscale(1),
  white: grayscale(3),
  grey: grayscale(5),
  dark: grayscale(7),
  veryDark: grayscale(9),
}

const EXCLUDED_NEUTRAL_FAMILIES = new Set([
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "mauve",
  "olive",
  "mist",
  "taupe",
])

type AllShades = ShadeScales & typeof customColors

export type TagColorName = keyof AllShades

export const CURATED_TAG_COLORS: TagColorName[] = [
  ...Object.entries(colors)
    .filter(
      ([name, value]) =>
        typeof value !== "string" && !EXCLUDED_NEUTRAL_FAMILIES.has(name),
    )
    .map(([name]) => name as TagColorName),
  ...(Object.keys(customColors) as TagColorName[]),
]

const palette: AllShades = { ...colors, ...customColors }

// tags that weren't given a colour still have to paint a pin, so they fall back to a grey that
// reads as "no colour assigned" rather than as one more hue competing with the real ones
const getShades = (name: TagColorName = "grey") => palette[name]

export const tagSolidColor = (name?: TagColorName) => getShades(name)[500]

// every tag color is pinned to the same lightness/chroma so pins read equally "crayon-soft" no
// matter the hue — only the hue itself comes from the tailwind swatch. Mixing straight toward gray
// (the previous approach) cut chroma by a flat percentage, which left warm hues (orange, green)
// looking fine by luck but collapsed cool hues (blue, purple) into an indistinguishable muddy gray
const CRAYON_LIGHTNESS = 80
const CRAYON_CHROMA = 0.25

export type CrayonTuning = { lightness: number; chroma: number }
export const DEFAULT_CRAYON_TUNING: CrayonTuning = {
  lightness: CRAYON_LIGHTNESS,
  chroma: CRAYON_CHROMA,
}
// tailwind's neutral families (gray, slate, zinc, stone, mauve, olive, mist, taupe...) are near-zero
// chroma by design — forcing them onto the crayon chroma wouldn't just soften them, it'd snap them
// onto whatever real hue they're faintly tinted toward (slate's hint of blue reads as an actual
// blue at full crayon chroma), making them near-duplicates of a vivid color instead of a neutral
const ACHROMATIC_CHROMA_THRESHOLD = 0.06

// tailwind writes a fully desaturated ramp as `oklch(87% 0 none)`. `none` is a real css keyword for
// "no hue", not a broken value, but reading it as a number gives NaN — and NaN loses every
// comparison, so the achromatic check below silently failed and neutrals got built into an invalid
// `oklch(80% 0.25 NaN)`, which svg paints as black
const oklchComponent = (raw?: string) =>
  raw && raw !== "none" ? Number(raw) : 0

function parseOklch(value: string) {
  const [, lightness, chroma, hue] =
    value.match(/oklch\(([\d.]+|none)%?\s+([\d.]+|none)\s+([\d.]+|none)/) ?? []
  return {
    lightness: oklchComponent(lightness),
    chroma: oklchComponent(chroma),
    hue: oklchComponent(hue),
  }
}

// pins sit on bright satellite imagery rather than a dark panel, so the lighter/thinner tailwind
// shades wash out — every tag color resolves through this instead of a raw shade
export function tagPinFillColor(
  name?: TagColorName,
  tuning: CrayonTuning = DEFAULT_CRAYON_TUNING,
) {
  const shades = getShades(name)
  const { chroma, hue } = parseOklch(shades[500])
  // achromatic families are meant to stay neutral, so they skip the crayon treatment
  if (chroma < ACHROMATIC_CHROMA_THRESHOLD) return shades[600]
  return `oklch(${tuning.lightness}% ${tuning.chroma} ${hue})`
}
// 950 is as dark as tailwind goes and still reads washed out against the satellite image, so the
// outline keeps going past the scale by mixing it down toward black
export const tagPinOutlineColor = (name?: TagColorName) =>
  `color-mix(in oklch, ${getShades(name)[950]} 45%, black)`

// near-white but not literally white — carries just enough of the tag's own hue that a pin's
// label reads as "this tag's color, whitened" rather than the same plain white for every tag
const LABEL_TEXT_LIGHTNESS = 96
const LABEL_TEXT_CHROMA = 0.045
export function tagLabelTextColor(name?: TagColorName) {
  const { chroma, hue } = parseOklch(getShades(name)[500])
  // achromatic families have no real hue to whiten toward, so the label just stays plain white
  if (chroma < ACHROMATIC_CHROMA_THRESHOLD) return "white"
  return `oklch(${LABEL_TEXT_LIGHTNESS}% ${LABEL_TEXT_CHROMA} ${hue})`
}

// past this the 500 shade is bright enough (yellow, lime, amber, and the near-white custom
// grayscale families) that white text on it stops being readable. On tailwind's own scale, which
// writes lightness as a percentage — `oklch(62.3% ...)` — so parseOklch hands back 62.3, not 0.623
const PALE_SOLID_LIGHTNESS = 70

// an active chip paints its solid tag color as the background, so the text has to pick whichever
// end of the scale the background isn't
function activeChipTextColor(name?: TagColorName) {
  const shades = getShades(name)
  const { lightness } = parseOklch(shades[500])
  return lightness > PALE_SOLID_LIGHTNESS ? shades[950] : "white"
}

// an inactive chip used to hardcode the 400 shade, which only ever worked on a dark panel — in
// light mode a pale tag color on a pale tint of that same color is invisible. Mixing toward
// currentColor instead makes the ink follow the theme for free: `currentColor` inside the `color`
// property resolves to the inherited color, which is --foreground, near-black in light and
// near-white in dark. Keeps enough of the tag's hue that the chip still reads as its own color
const INACTIVE_CHIP_HUE_SHARE = 55

// tailwind's utility classes can't be built from a runtime variable (the compiler only picks up
// literal class strings), so tag colors resolve through tailwindcss's own color palette instead
// and get applied as inline styles
export function tagColorStyle(name: TagColorName | undefined, active: boolean) {
  const solid = tagSolidColor(name)
  if (active)
    return {
      backgroundColor: solid,
      color: activeChipTextColor(name),
      // just a soft drop shadow to lift it off the page, no inset rim
      boxShadow: "0 6px 18px -4px rgba(0,0,0,0.6)",
    }
  return {
    backgroundColor: `color-mix(in oklch, ${solid} 15%, transparent)`,
    color: `color-mix(in oklch, ${solid} ${INACTIVE_CHIP_HUE_SHARE}%, currentColor)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${solid} 30%, transparent)`,
  }
}
