import colors from "tailwindcss/colors"

// tailwind's palette also exports flat keywords (inherit, current, transparent, black, white) that
// have no shade scale, so they're filtered out of the tag colors
type ShadeScales = {
  [Name in keyof typeof colors as (typeof colors)[Name] extends string
    ? never
    : Name]: (typeof colors)[Name]
}

export type TagColorName = keyof ShadeScales

// a reasonable spread for the admin's tag color picker — the full palette has dozens of
// near-duplicate hues, most of which would just make the picker harder to scan
export const CURATED_TAG_COLORS: TagColorName[] = [
  "red",
  "orange",
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

const palette: ShadeScales = colors

// tags that weren't given a colour still have to paint a pin, so they fall back to a grey that
// reads as "no colour assigned" rather than as one more hue competing with the real ones
const getShades = (name: TagColorName = "neutral") => palette[name]

export const tagSolidColor = (name?: TagColorName) => getShades(name)[500]

// pins run a shade deeper than the filter pills: they sit on bright satellite imagery rather than
// a dark panel, so the lighter shades wash out against it. Tailwind's 600 shade on its own is
// neon against that imagery, so it's pulled back toward gray — hues stay distinct, nothing screams
export const tagPinFillColor = (name?: TagColorName) =>
  `color-mix(in oklch, ${getShades(name)[600]} 60%, gray)`
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
