"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"

export type MenuAction = {
  id: string
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  description: string
  onSelect: () => void
  isHighlighted?: boolean
}

const MobileMenuSheet = dynamic(() => import("./MobileMenuSheet"))

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
  // the sheet is a separate chunk, only fetched the first time the menu is opened
  const [hasOpened, setHasOpened] = useState(false)

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
        onClick={() => {
          setHasOpened(true)
          setIsOpen(true)
        }}
      />
      {hasOpened && (
        <MobileMenuSheet
          open={isOpen}
          onOpenChange={setIsOpen}
          actions={actions}
          onSelect={selectAction}
        />
      )}
    </>
  )
}
