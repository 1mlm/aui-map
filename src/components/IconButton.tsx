import type { ComponentProps } from "react"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { Icon, type HugeIcon } from "./Icon"

const toneClasses = {
  // sits on a photo or another dark surface
  overlay: "bg-white/10 text-white hover:bg-white/20",
  // sits on the app's own background, so it tints with the theme instead of forcing white
  subtle:
    "bg-foreground/10 text-foreground/70 hover:bg-foreground/15 hover:text-foreground",
  // sits directly on the map, where it needs its own backdrop to stay legible
  floating: "bg-black/60 text-white backdrop-blur-sm hover:bg-black/70",
  // the control is doing something right now — a search is typed, filters are on
  primary: "bg-primary text-primary-foreground hover:bg-primary/85",
} as const

const sizeClasses = {
  sm: "size-8",
  md: "size-9",
  lg: "size-10",
} as const

export function IconButton({
  icon,
  label,
  tone = "subtle",
  size = "md",
  // "stack" puts the label under the glyph, for the cramped mobile control bar. "inline" sits it
  // beside the glyph instead, reading as an ordinary labelled button — used where there's enough
  // width (the desktop control bar) that stacking would waste it
  layout = "stack",
  iconClassName,
  className,
  onClick,
  ...props
}: ComponentProps<"button"> & {
  icon: HugeIcon
  // when set, the button grows a caption next to (or under) its glyph instead of staying a bare
  // square. A glyph alone asks people to guess; the word means they don't have to
  label?: string
  tone?: keyof typeof toneClasses
  size?: keyof typeof sizeClasses
  layout?: "stack" | "inline"
  iconClassName?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center rounded-full corner-squircle transition-colors",
        toneClasses[tone],
        label
          ? layout === "inline"
            ? "h-9 gap-1.5 rounded-full px-3.5"
            : "min-w-14 flex-col gap-0.5 rounded-2xl px-2 py-1.5"
          : sizeClasses[size],
        className,
      )}
      onClick={(e) => {
        triggerHaptic()
        onClick?.(e)
      }}
      {...props}
    >
      <Icon {...{ icon }} className={iconClassName} />
      {label && (
        <span
          className={cn(
            "font-medium whitespace-nowrap",
            layout === "inline" ? "text-sm" : "text-[0.65rem] leading-none",
          )}
        >
          {label}
        </span>
      )}
    </button>
  )
}
