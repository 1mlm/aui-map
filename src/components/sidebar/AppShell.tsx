"use client"

import { useTransition } from "react"
import type { PropsWithChildren } from "react"
import { logout } from "@/app/admin/(dashboard)/actions"
import { AppNav } from "@/components/app-nav/AppNav"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { APP_HEADER, NAV_ITEMS } from "./data"
import { LogoutButton } from "./LogoutButton"

function MobileLogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
      className="w-full rounded-full corner-squircle text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      <Icon icon={pending ? ICONS.loading : ICONS.logout} className={pending ? "animate-spin" : undefined} />
      Log out
    </Button>
  )
}

export type NavCounts = Record<"pins" | "tags" | "submissions" | "suggestions", number>

export function AppShell({ counts, children }: PropsWithChildren<{ counts: NavCounts }>) {
  return (
    <AppNav
      brand={APP_HEADER}
      items={NAV_ITEMS}
      {...{ counts }}
      sidebarFooter={<LogoutButton />}
      sheetTitle="More options"
      sheetDescription="Account actions"
      sheetFooter={() => <MobileLogoutButton />}
    >
      {children}
    </AppNav>
  )
}
