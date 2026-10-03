"use client"

import { useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/shadcn/ui/drawer"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"

type MenuAction = {
  id: string
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  description: string
  onSelect: () => void
  isHighlighted?: boolean
}

// the phone's whole overflow menu: a vaul drawer (drag down to close) whose visible part is a
// card inset from the screen edges so it floats instead of sitting glued to the bottom
export function MobileMenu({
  onContribute,
  onOpenCredits,
  onInstall,
}: {
  onContribute: () => void
  onOpenCredits: () => void
  onInstall?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const actions: MenuAction[] = [
    {
      id: "contribute",
      icon: ICONS.contributeMenu,
      label: "Contribute",
      description: "add a place, photos or a fix",
      onSelect: onContribute,
    },
    ...(onInstall
      ? [
          {
            id: "install",
            icon: ICONS.download,
            label: "Download as app",
            description: "opens from your home screen, works offline",
            onSelect: onInstall,
            isHighlighted: true,
          },
        ]
      : []),
    {
      id: "credits",
      icon: ICONS.notice,
      label: "About and credits",
      description: "who made this and how it works",
      onSelect: onOpenCredits,
    },
  ]

  const selectAction = (action: MenuAction) => {
    triggerHaptic("selection")
    setIsOpen(false)
    action.onSelect()
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <IconButton
          icon={ICONS.moreActions}
          aria-label="Menu"
          tone="floating"
          shape="corner-superellipse/1.2"
          iconClassName="size-5"
          className={cn(
            "size-12 shrink-0 shadow-lg drop-shadow-black/40",
            onInstall && "animate-pulse-attention",
          )}
        />
      </DrawerTrigger>
      <DrawerContent
        aria-describedby={undefined}
        className="border-none! bg-transparent p-2 [&>div:first-child]:hidden"
      >
        <div className="flex flex-col gap-3 rounded-3xl corner-superellipse/1.2 bg-popover p-3.5 pt-2 text-popover-foreground ring-1 ring-border">
          <span className="mx-auto h-1 w-10 rounded-full bg-foreground/20" />
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-sm font-semibold">AUI Map</DrawerTitle>
            <DrawerClose
              aria-label="Close menu"
              className="grid size-7 place-items-center rounded-full text-foreground/60 ring-1 ring-border"
            >
              <Icon icon={ICONS.close} className="size-3.5" />
            </DrawerClose>
          </div>
          <nav className="flex flex-col gap-1.5">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => selectAction(action)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl corner-superellipse/1.2 p-2.5 text-left ring-1 ring-border transition-colors hover:bg-accent",
                  action.isHighlighted && "bg-accent",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground text-background">
                  <Icon icon={action.icon} className="size-5" />
                </span>
                <span className="leading-tight">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </span>
              </button>
            ))}
          </nav>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
