import type { CSSProperties, PropsWithChildren } from "react"
import { cn } from "@/shadcn/utils"

// corner = which corner of the square the visible fillet sliver occupies
const fuserMaskByCorner = {
  "top-left":
    "[mask:radial-gradient(circle_at_bottom_right,transparent_1em,#000_0)]",
  "top-right":
    "[mask:radial-gradient(circle_at_bottom_left,transparent_1em,#000_0)]",
  "bottom-left":
    "[mask:radial-gradient(circle_at_top_right,transparent_1em,#000_0)]",
  "bottom-right":
    "[mask:radial-gradient(circle_at_top_left,transparent_1em,#000_0)]",
} as const
type SquircleFuserCorner = keyof typeof fuserMaskByCorner

// Each entry says how the pill squares itself off against the edge it's docked to, and where its
// two bridging patches sit. Adding a new dock position means adding a row here, nothing else.
const layoutByAlign = {
  "top-center": {
    pill: "flex-row pt-2 pr-8 pb-3 pl-6 rounded-full rounded-t-none",
    fusers: [
      { corner: "top-right", at: "right-full top-0" },
      { corner: "top-left", at: "left-full top-0" },
    ],
  },
  "top-left": {
    pill: "flex-row pt-2 pr-8 pb-3 pl-4 rounded-br-full!",
    fusers: [
      { corner: "top-left", at: "left-full top-0" },
      { corner: "top-left", at: "top-full left-0" },
    ],
  },
  "top-right": {
    pill: "flex-row pt-2 pr-4 pb-3 pl-6 rounded-bl-full!",
    fusers: [
      { corner: "top-right", at: "right-full top-0" },
      { corner: "top-right", at: "top-full right-0" },
    ],
  },
  right: {
    pill: "flex-col px-3 pt-6 pb-8 rounded-l-full!",
    fusers: [
      { corner: "bottom-right", at: "right-0 bottom-full" },
      { corner: "top-right", at: "right-0 top-full" },
    ],
  },
  "bottom-center": {
    pill: "flex-row px-5 pt-3 pb-2 rounded-t-full!",
    fusers: [
      { corner: "bottom-right", at: "right-full bottom-0" },
      { corner: "bottom-left", at: "left-full bottom-0" },
    ],
  },
  "bottom-right": {
    pill: "flex-row px-5 pt-3 pb-2 rounded-tl-full!",
    fusers: [
      { corner: "bottom-right", at: "right-full bottom-0" },
      { corner: "bottom-right", at: "right-0 bottom-full" },
    ],
  },
  "bottom-left": {
    pill: "flex-row pl-4 pr-5 pt-3 pb-2 rounded-tr-full!",
    fusers: [
      { corner: "bottom-left", at: "bottom-0 left-full" },
      { corner: "bottom-left", at: "bottom-full left-0" },
    ],
  },
} satisfies Record<
  string,
  { pill: string; fusers: { corner: SquircleFuserCorner; at: string }[] }
>

type Align = keyof typeof layoutByAlign

// corner-docked containers sit flush against a page corner, but chrome's subpixel rounding can
// leave a hairline gap there that peeks the map through — nudging a css pixel further into the
// corner guarantees full overlap regardless of how the browser rounds the fractional position
const cornerNudgeByAlign: Partial<Record<Align, string>> = {
  "top-left": "-translate-x-px -translate-y-px",
  "top-right": "translate-x-px -translate-y-px",
  "bottom-left": "-translate-x-px translate-y-px",
  "bottom-right": "translate-x-px translate-y-px",
}

// same chrome subpixel-rounding gap, but between each fuser patch and the pill it's docked
// against — `at` always carries exactly one "*-full" token naming which pill edge the fuser
// touches, so nudging 1.1px toward that edge closes the seam on both the pill and the outer
// border it's meant to fuse into. Classes are written out literally (not templated) since
// tailwind's build-time scanner can't see an arbitrary-value class assembled at runtime
export function fuserOverlapClass(at: string): string {
  if (at.includes("right-full")) return "translate-x-[1.1px]"
  if (at.includes("left-full")) return "-translate-x-[1.1px]"
  if (at.includes("top-full")) return "-translate-y-[1.1px]"
  if (at.includes("bottom-full")) return "translate-y-[1.1px]"
  return ""
}

// ported from o41's SquircleFuserContainer: a pill-shaped badge/bar that fuses into its
// surroundings by squaring off the edges touching a page corner, then bridging the gap with
// external SquircleFuser patches so the outer silhouette still reads as one smooth squircle
export function SquircleFuserContainer({
  children,
  superClassName,
  className,
  style,
  align = "top-center",
  background = "bg-background",
}: PropsWithChildren<{
  superClassName?: string
  className?: string
  align?: Align
  style?: CSSProperties
  background?: string
}>) {
  const layout = layoutByAlign[align]

  return (
    <div
      className={cn(
        "relative w-fit drop-shadow-lg drop-shadow-black/40",
        cornerNudgeByAlign[align],
        superClassName,
      )}
      {...{ style }}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2.5 corner-squircle",
          background,
          layout.pill,
          className,
        )}
      >
        {children}
      </div>

      {layout.fusers.map(({ corner, at }) => (
        <SquircleFuser
          key={`${corner}-${at}`}
          className={cn("absolute", at, fuserOverlapClass(at))}
          {...{ corner, background }}
        />
      ))}
    </div>
  )
}

export function SquircleFuser({
  corner,
  background = "bg-background",
  className,
}: {
  corner: SquircleFuserCorner
  background?: string
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "aspect-square! h-[1em]! w-auto!",
        background,
        fuserMaskByCorner[corner],
        className,
      )}
    />
  )
}

// corner = the panel corner the dent is carved out of (opposite naming from SquircleFuser,
// which names the corner its solid sliver occupies instead)
const dentByCorner = {
  "top-left": {
    mask: "[mask:radial-gradient(circle_at_top_left,transparent_1em,#000_0)]",
    at: "top-0 left-0",
  },
  "top-right": {
    mask: "[mask:radial-gradient(circle_at_top_right,transparent_1em,#000_0)]",
    at: "top-0 right-0",
  },
  "bottom-left": {
    mask: "[mask:radial-gradient(circle_at_bottom_left,transparent_1em,#000_0)]",
    at: "bottom-0 left-0",
  },
  "bottom-right": {
    mask: "[mask:radial-gradient(circle_at_bottom_right,transparent_1em,#000_0)]",
    at: "bottom-0 right-0",
  },
} as const

// same squircle-fuse mask as SquircleFuser, but sits on top of the panel's own corner and
// carves a concave bite out of it instead of sitting beside it — for panels flush on every
// side but one (like a full-height side panel), where there's no open margin to plant an
// external SquircleFuser patch in
export function CornerFuse({
  corner,
  background = "bg-background",
  className,
}: {
  corner: keyof typeof dentByCorner
  background?: string
  className?: string
}) {
  const dent = dentByCorner[corner]

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute aspect-square! h-[1em]! w-auto!",
        dent.at,
        background,
        dent.mask,
        className,
      )}
    />
  )
}
