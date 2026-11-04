"use client"

import { Icon } from "@/components/Icon"
import { ResponsiveOverlay } from "@/components/ResponsiveOverlay"
import { cn } from "@/shadcn/utils"
import { MadeWithCredit } from "./About"
import type { MenuAction } from "./MobileMenu"

// split out of MobileMenu so the dialog/drawer code only downloads once the menu is first opened
export default function MobileMenuSheet({
  open,
  onOpenChange,
  actions,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: MenuAction[]
  onSelect: (action: MenuAction) => void
}) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="AUI Map"
      footer={<MadeWithCredit />}
    >
      <nav className="flex flex-col gap-1.5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onSelect(action)}
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
  )
}
