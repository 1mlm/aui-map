"use client"

import {
  type ComponentProps,
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { cn } from "@/shadcn/utils"
import { useHasHoverSupport } from "@/utils/useHasHoverSupport"

// no library on purpose: the Radix tooltip alone was a chunk of the first-load JS for a label that
// shows on hover. This is css only (group hover / focus-within) plus an optional controlled `open`
// and, on touch (no hover), a tap that shows the label for a moment

const TAP_TOOLTIP_VISIBLE_MS = 1600

type TooltipState = { open: boolean; reveal: (() => void) | null }
const TooltipContext = createContext<TooltipState>({
  open: false,
  reveal: null,
})

export function Tooltip({
  open: controlledOpen,
  onOpenChange,
  children,
}: PropsWithChildren<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>) {
  const hasHover = useHasHoverSupport()
  const [tapOpen, setTapOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function reveal() {
    clearTimeout(timer.current)
    setTapOpen(true)
    onOpenChange?.(true)
    timer.current = setTimeout(() => {
      setTapOpen(false)
      onOpenChange?.(false)
    }, TAP_TOOLTIP_VISIBLE_MS)
  }

  return (
    <TooltipContext.Provider
      value={{
        open: controlledOpen ?? tapOpen,
        reveal: hasHover ? null : reveal,
      }}
    >
      <span className="group/tooltip relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  )
}

// the trigger is just its child, the wrapper span in Tooltip already carries the hover/focus state
export function TooltipTrigger({
  children,
}: PropsWithChildren<{ asChild?: boolean }>) {
  const { reveal } = useContext(TooltipContext)
  if (!reveal) return <>{children}</>
  return (
    <span className="contents" onClickCapture={reveal}>
      {children}
    </span>
  )
}

export function TooltipContent({
  side = "top",
  sideOffset = 0,
  className,
  children,
}: ComponentProps<"span"> & { side?: "top" | "bottom"; sideOffset?: number }) {
  const { open } = useContext(TooltipContext)
  return (
    <span
      role="tooltip"
      style={{ [side === "bottom" ? "marginTop" : "marginBottom"]: sideOffset }}
      className={cn(
        "pointer-events-none absolute left-1/2 z-50 inline-flex w-max max-w-xs -translate-x-1/2 items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-background text-xs opacity-0 transition-opacity duration-100 group-focus-within/tooltip:opacity-100 group-hover/tooltip:opacity-100",
        side === "bottom" ? "top-full" : "bottom-full",
        open && "opacity-100",
        className,
      )}
    >
      {children}
    </span>
  )
}
