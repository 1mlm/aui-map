"use client"

import { cn } from "@/shadcn/utils"
import { MoreSheet } from "./MoreSheet"
import { NavLink } from "./NavLink"
import type { AppNavBrand, AppNavItem, SheetFooterRenderer } from "./types"
import { useHideOnScrollDown } from "./useHideOnScrollDown"

export function MobileTopBar({
  brand,
  items,
  counts,
  sheetTitle = "More options",
  sheetDescription = "Settings and account actions",
  sheetFooter,
}: {
  brand: AppNavBrand
  items: AppNavItem[]
  counts: Record<string, number>
  sheetTitle?: string
  sheetDescription?: string
  sheetFooter: SheetFooterRenderer
}) {
  const hidden = useHideOnScrollDown()

  return (
    <nav
      className={cn(
        "fixed inset-x-4 top-4 z-20 flex overflow-hidden rounded-t-[1.5rem]! rounded-b-[2rem]! corner-squircle border border-border/50 bg-sidebar/90 shadow-lg backdrop-blur-sm transition-transform duration-200 ease-in-out sm:hidden",
        hidden && "-translate-y-[calc(100%+2rem)]",
      )}
    >
      {items.map((item) => (
        <NavLink key={item.href} {...item} count={item.countKey ? counts[item.countKey] : undefined} />
      ))}
      <MoreSheet {...{ brand, sheetTitle, sheetDescription, sheetFooter }} />
    </nav>
  )
}
