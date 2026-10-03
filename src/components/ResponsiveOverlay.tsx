"use client"

import type { ReactNode } from "react"
import { BottomDrawer } from "@/components/BottomDrawer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { useIsPhone } from "@/utils/useIsPhone"

// a bottom drawer on phones, a regular centered dialog everywhere else
export function ResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  const isPhone = useIsPhone()

  if (isPhone)
    return (
      <BottomDrawer
        {...{ open, onOpenChange, title, description, footer, className }}
      >
        {children}
      </BottomDrawer>
    )

  return (
    <Dialog {...{ open, onOpenChange }}>
      <DialogContent className="corner-squircle sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        {children}
        {footer}
      </DialogContent>
    </Dialog>
  )
}
