"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { triggerHaptic } from "@/utils/haptics"
import { NavLinkContent } from "./NavLinkContent"
import type { AppNavItem } from "./types"

export function NavLink({ href, label, icon, count }: AppNavItem & { count?: number }) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(href)

  return (
    <Link
      {...{ href }}
      onClick={() => triggerHaptic("light")}
      className="flex flex-1 flex-col items-center py-2.5"
    >
      <NavLinkContent {...{ label, icon, isActive, count }} />
    </Link>
  )
}
