import type { AppNavBrand, AppNavItem } from "@/components/app-nav/types"
import { ICONS } from "@/icons"

export const APP_HEADER: AppNavBrand = {
  iconSrc: "/icon.webp",
  text: "AUI Map",
  subtext: "Admin",
}

export const NAV_ITEMS: AppNavItem[] = [
  { href: "/admin/pins", label: "Pins", icon: ICONS.place, countKey: "pins" },
  { href: "/admin/tags", label: "Tags", icon: ICONS.tag, countKey: "tags" },
]
