"use client"

import { type ReactNode, useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"

// a plain show/hide toggle for fields that don't need to be visible by default — no shadcn
// primitive installed for this and the need is simple enough not to warrant one
export function Disclosure({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium hover:text-foreground"
      >
        <Icon
          icon={ICONS.carouselNext}
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        {label}
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  )
}
