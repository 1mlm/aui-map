"use client"

import { Loading01Icon, LogoutIcon } from "@hugeicons/core-free-icons"
import { useTransition } from "react"
import { logout } from "@/app/admin/(dashboard)/actions"
import { Icon } from "@/components/Icon"
import { SidebarMenuButton, SidebarMenuItem } from "@/shadcn/ui/sidebar"

export function LogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        disabled={pending}
        onClick={() => startTransition(() => logout())}
        tooltip="Log out"
        className="rounded-full corner-squircle text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Icon icon={pending ? Loading01Icon : LogoutIcon} className={pending ? "animate-spin" : undefined} />
        <span>Log out</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
