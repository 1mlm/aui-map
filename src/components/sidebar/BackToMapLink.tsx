"use client"

import Link from "next/link"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { SidebarMenuButton, SidebarMenuItem } from "@/shadcn/ui/sidebar"

// leaves the admin for the public map
export function BackToMapLink() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip="Back to the map"
        className="rounded-full corner-squircle"
      >
        <Link href="/">
          <Icon icon={ICONS.place} />
          <span>Back to the map</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
