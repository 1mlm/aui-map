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
  { href: "/admin/analytics", label: "Analytics", icon: ICONS.analytics },
  {
    href: "/admin/comments",
    label: "Comments",
    icon: ICONS.comment,
    countKey: "comments",
  },
  {
    href: "/admin/search-misses",
    label: "Missed searches",
    icon: ICONS.search,
    countKey: "searchMisses",
  },
]
