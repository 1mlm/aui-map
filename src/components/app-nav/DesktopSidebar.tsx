"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Icon } from "@/components/Icon"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/shadcn/ui/sidebar"
import type { AppNavBrand, AppNavItem } from "./types"

export function DesktopSidebar({
  brand,
  items,
  counts,
  footer,
}: {
  brand: AppNavBrand
  items: AppNavItem[]
  counts: Record<string, number>
  footer: ReactNode
}) {
  const pathname = usePathname()

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-1 group-data-[collapsible=icon]:flex-col">
            <SidebarMenu className="flex-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="rounded-full corner-squircle select-none! active:bg-sidebar hover:bg-sidebar cursor-auto"
                >
                  <Image
                    src={brand.iconSrc}
                    alt={brand.text}
                    width={40}
                    height={40}
                    className="size-8 shrink-0 group-data-[collapsible=icon]:size-10"
                  />
                  <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold leading-tight">{brand.text}</span>
                    {brand.subtext && (
                      <span className="text-xs font-normal leading-tight text-muted-foreground">
                        {brand.subtext}
                      </span>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarTrigger className="rounded-full corner-squircle shrink-0" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2">
            {items.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const count = item.countKey ? counts[item.countKey] : undefined
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    {...{ isActive }}
                    tooltip={item.label}
                    className="rounded-full corner-squircle"
                  >
                    <Link href={item.href}>
                      <Icon icon={item.icon} />
                      <span>{item.label}</span>
                      {Boolean(count) && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                          {count}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>{footer}</SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarRail />
    </>
  )
}
