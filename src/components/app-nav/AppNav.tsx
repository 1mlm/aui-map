"use client"

import type { PropsWithChildren, ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@/shadcn/ui/sidebar"
import { DesktopSidebar } from "./DesktopSidebar"
import { MobileTopBar } from "./MobileTopBar"
import type { AppNavBrand, AppNavItem, SheetFooterRenderer } from "./types"

// desktop sidebar (via shadcn's Sidebar primitive) and mobile top bar are
// two genuinely different shells around the same nav data — merging their
// markup into one component would fight either the compact sidebar-row
// look or the pill-shaped sheet look, so they stay separate renderers
// sharing one data contract instead
export function AppNav({
  brand,
  items,
  counts = {},
  sidebarFooter,
  sheetTitle,
  sheetDescription,
  sheetFooter,
  children,
}: PropsWithChildren<{
  brand: AppNavBrand
  items: AppNavItem[]
  counts?: Record<string, number>
  sidebarFooter: ReactNode
  sheetTitle?: string
  sheetDescription?: string
  sheetFooter: SheetFooterRenderer
}>) {
  return (
    <SidebarProvider>
      <DesktopSidebar {...{ brand, items, counts }} footer={sidebarFooter} />
      <SidebarInset className="md:h-[calc(100svh-2rem)] md:overflow-y-auto">
        <MobileTopBar {...{ brand, items, counts, sheetTitle, sheetDescription, sheetFooter }} />
        <div className="pt-20 sm:pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
