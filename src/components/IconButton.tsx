import type { ComponentProps } from "react"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { Icon, type HugeIcon } from "./Icon"

const toneClasses = {
  // sits on a photo or another dark surface
  overlay: "bg-white/10 text-white hover:bg-white/20",
  // sits on the app's own background, so it tints with the theme instead of forcing white
  subtle: "bg-foreground/10 text-foreground/70 hover:bg-foreground/15 hover:text-foreground",
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
  tone = "subtle",
  size = "md",
  iconClassName,
  className,
  onClick,
  ...props
}: ComponentProps<"button"> & {
  icon: HugeIcon
  tone?: keyof typeof toneClasses
  size?: keyof typeof sizeClasses
  iconClassName?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center rounded-full corner-squircle transition-colors",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      onClick={(e) => {
        triggerHaptic()
        onClick?.(e)
      }}
      {...props}
    >
      <Icon {...{ icon }} className={iconClassName} />
    </button>
  )
}
