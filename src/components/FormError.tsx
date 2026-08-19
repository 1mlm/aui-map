"use client"

import { Alert02Icon } from "@hugeicons/core-free-icons"
import { type ReactNode, useEffect } from "react"
import { Icon } from "@/components/Icon"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"

export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: only fires when the error appears, not on every children re-render
  useEffect(() => {
    if (children) triggerHaptic("error")
  }, [Boolean(children)])

  if (!children) return null

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-destructive", className)}>
      <Icon icon={Alert02Icon} />
      {children}
    </span>
  )
}
