"use client"

import { useState } from "react"
import { ResponsiveOverlay } from "@/components/ResponsiveOverlay"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { MadeWithCredit } from "./About"

type MenuAction = {
  id: string
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  description: string
  onSelect: () => void
  isHighlighted?: boolean
}

// the phone's whole overflow menu, every row hands off to its own drawer (or the browser's
// install prompt) once this one has closed
export function MobileMenu({
  onOpenAbout,
  onInstall,
}: {
  onOpenAbout: () => void
  onInstall?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const actions: MenuAction[] = [
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
      id: "about",
      icon: ICONS.notice,
      label: "About",
      description: "what this is and who is behind it",
      onSelect: onOpenAbout,
    },
  ]

  const selectAction = (action: MenuAction) => {
    triggerHaptic("selection")
    setIsOpen(false)
    action.onSelect()
  }

  return (
    <>
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
        onClick={() => setIsOpen(true)}
      />
      <ResponsiveOverlay
        open={isOpen}
        onOpenChange={setIsOpen}
        title="AUI Map"
        footer={<MadeWithCredit />}
      >
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
      </ResponsiveOverlay>
    </>
  )
}
