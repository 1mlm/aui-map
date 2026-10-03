"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/shadcn/ui/drawer"
import { cn } from "@/shadcn/utils"

// the one popup shape in the app: a vaul drawer (drag down to close) that's itself transparent,
// the visible part is a card inset from the screen edges so it floats instead of being glued to
// the bottom
export function BottomDrawer({
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
  return (
    <Drawer {...{ open, onOpenChange }}>
      <DrawerContent
        aria-describedby={undefined}
        className="border-none! bg-transparent p-2 [&>div:first-child]:hidden"
      >
        <div
          className={cn(
            "mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col gap-3 rounded-3xl corner-superellipse/1.2 bg-popover p-3.5 pt-2 text-popover-foreground ring-1 ring-border",
            className,
          )}
        >
          <span className="mx-auto h-1 w-10 shrink-0 rounded-full bg-foreground/20" />
          <div className="flex shrink-0 items-center justify-between">
            <span className="leading-tight">
              <DrawerTitle className="text-sm font-semibold">{title}</DrawerTitle>
              {description && (
                <DrawerDescription className="text-xs">
                  {description}
                </DrawerDescription>
              )}
            </span>
            <DrawerClose
              aria-label="Close"
              className="grid size-7 shrink-0 place-items-center rounded-full text-foreground/60 ring-1 ring-border"
            >
              <Icon icon={ICONS.close} className="size-3.5" />
            </DrawerClose>
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {children}
          </div>
          {footer}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
