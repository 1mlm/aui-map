"use client"

import { Loading01Icon } from "@hugeicons/core-free-icons"
import { useLinkStatus } from "next/link"
import { Icon } from "@/components/Icon"
import { cn } from "@/shadcn/utils"
import type { AppNavItem } from "./types"

// reads the pending status of the nearest ancestor <Link> — must be a
// child of that Link to see its navigation context
export function NavLinkContent({
  label,
  icon,
  isActive,
  count,
}: {
  label: string
  icon: AppNavItem["icon"]
  isActive: boolean
  count?: number
}) {
  const { pending } = useLinkStatus()

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 text-muted-foreground",
        isActive && "text-foreground",
        pending && "opacity-60",
      )}
    >
      <div className="relative">
        <Icon icon={pending ? Loading01Icon : icon} className={cn("size-5", pending && "animate-spin")} />
        {!pending && Boolean(count) && (
          <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full corner-squircle bg-muted px-1 text-[0.6rem] text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <span className="text-[0.65rem]">{label}</span>
    </div>
  )
}
