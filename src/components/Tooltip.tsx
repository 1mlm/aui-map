"use client"

import {
  type ComponentProps,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "@/shadcn/ui/tooltip"
import { useHasHoverSupport } from "@/utils/useHasHoverSupport"

const TAP_TOOLTIP_VISIBLE_MS = 1600

const TapTooltipContext = createContext<(() => void) | null>(null)

// Radix's tooltip only opens on hover/focus, neither of which a touch tap reliably produces —
// the label either never shows or flashes for a frame. On a device with no real hover (touch),
// this makes the tooltip content ride along on the same tap that already triggers the button's
// own onClick, staying open long enough to actually read before auto-dismissing. Devices with
// real hover get Radix's normal hover/focus behavior, completely untouched
export function Tooltip({
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive>) {
  const hasHover = useHasHoverSupport()
  const [open, setOpen] = useState(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => () => clearTimeout(dismissTimer.current), [])

  if (hasHover)
    return <TooltipPrimitive {...props}>{children}</TooltipPrimitive>

  function reveal() {
    clearTimeout(dismissTimer.current)
    setOpen(true)
    dismissTimer.current = setTimeout(
      () => setOpen(false),
      TAP_TOOLTIP_VISIBLE_MS,
    )
  }

  return (
    <TapTooltipContext.Provider value={reveal}>
      <TooltipPrimitive open={open} onOpenChange={setOpen} {...props}>
        {children}
      </TooltipPrimitive>
    </TapTooltipContext.Provider>
  )
}

export function TooltipTrigger(
  props: ComponentProps<typeof TooltipTriggerPrimitive>,
) {
  const reveal = useContext(TapTooltipContext)
  if (!reveal) return <TooltipTriggerPrimitive {...props} />

  // captures ahead of the trigger's own onClick (which still fires normally, e.g. centering the
  // map) — `contents` keeps this span out of flex/gap layout entirely, it's here purely to catch
  // the tap
  return (
    <span className="contents" onClickCapture={reveal}>
      <TooltipTriggerPrimitive {...props} />
    </span>
  )
}

export { TooltipContent, TooltipProvider } from "@/shadcn/ui/tooltip"
