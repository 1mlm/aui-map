import colors from "tailwindcss/colors"

// tailwind's palette also exports flat keywords (inherit, current, transparent, black, white) that
// have no shade scale, so they're filtered out of the tag colors
type ShadeScales = {
  [Name in keyof typeof colors as (typeof colors)[Name] extends string
    ? never
    : Name]: (typeof colors)[Name]
}

// tailwind ships no actual brown — academic buildings want one, so it's added as its own scale,
// hue-locked to a chestnut/sienna tone with the chroma capped low so it reads as muted "institutional"
// brown rather than orange. Shaped the same as a tailwind scale so every helper below can treat it
// identically to a real palette entry
const customColors = {
  brown: {
    50: "oklch(97% 0.016 38)",
    100: "oklch(93% 0.032 38)",
    200: "oklch(86% 0.05 38)",
    300: "oklch(77% 0.065 38)",
    400: "oklch(66% 0.08 38)",
    500: "oklch(56% 0.09 38)",
    600: "oklch(47% 0.09 36)",
    700: "oklch(39% 0.085 34)",
    800: "oklch(32% 0.07 32)",
    900: "oklch(26% 0.055 30)",
    950: "oklch(17% 0.035 28)",
  },
} as const

type AllShades = ShadeScales & typeof customColors

export type TagColorName = keyof AllShades

// a reasonable spread for the admin's tag color picker — the full palette has dozens of
// near-duplicate hues, most of which would just make the picker harder to scan
export const CURATED_TAG_COLORS: TagColorName[] = [
  "red",
  "orange",
  "brown",
  "amber",
  "yellow",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "rose",
  "mauve",
  "mist",
  "taupe",
  "slate",
  "gray",
]

const palette: AllShades = { ...colors, ...customColors }

// tags that weren't given a colour still have to paint a pin, so they fall back to a grey that
// reads as "no colour assigned" rather than as one more hue competing with the real ones
const getShades = (name: TagColorName = "neutral") => palette[name]

export const tagSolidColor = (name?: TagColorName) => getShades(name)[500]

// every tag color is pinned to the same lightness/chroma so pins read equally "crayon-soft" no
// matter the hue — only the hue itself comes from the tailwind swatch. Mixing straight toward gray
// (the previous approach) cut chroma by a flat percentage, which left warm hues (orange, green)
// looking fine by luck but collapsed cool hues (blue, purple) into an indistinguishable muddy gray
const CRAYON_LIGHTNESS = 62
const CRAYON_CHROMA = 0.135
// tailwind's neutral families (gray, slate, mauve, taupe...) are near-zero chroma by design — forcing
// them onto the crayon chroma would inject a fake hue into what's meant to read as "no color"
const ACHROMATIC_CHROMA_THRESHOLD = 0.03

function parseOklch(value: string) {
  const [, lightness, chroma, hue] =
    value.match(/oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)/) ?? []
  return {
    lightness: Number(lightness),
    chroma: Number(chroma),
    hue: Number(hue),
  }
}

// pins sit on bright satellite imagery rather than a dark panel, so the lighter/thinner tailwind
// shades wash out — every tag color resolves through this instead of a raw shade
export function tagPinFillColor(name?: TagColorName) {
  const { chroma, hue } = parseOklch(getShades(name)[500])
  // brown is deliberately muted (academic buildings are "boring" on purpose), and achromatic
  // families are meant to stay neutral — both skip the crayon treatment and use a plain solid shade
  if (name === "brown" || chroma < ACHROMATIC_CHROMA_THRESHOLD)
    return getShades(name)[600]
  return `oklch(${CRAYON_LIGHTNESS}% ${CRAYON_CHROMA} ${hue})`
}
// 950 is as dark as tailwind goes and still reads washed out against the satellite image, so the
// outline keeps going past the scale by mixing it down toward black
export const tagPinOutlineColor = (name?: TagColorName) =>
  `color-mix(in oklch, ${getShades(name)[950]} 45%, black)`

// tailwind's utility classes can't be built from a runtime variable (the compiler only picks up
// literal class strings), so tag colors resolve through tailwindcss's own color palette instead
// and get applied as inline styles
export function tagColorStyle(name: TagColorName | undefined, active: boolean) {
  const solid = tagSolidColor(name)
  if (active)
    return {
      backgroundColor: solid,
      color: "white",
      // just a soft drop shadow to lift it off the page, no inset rim
      boxShadow: "0 6px 18px -4px rgba(0,0,0,0.6)",
    }
  return {
    backgroundColor: `color-mix(in oklch, ${solid} 15%, transparent)`,
    color: getShades(name)[400],
    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${solid} 30%, transparent)`,
  }
}
