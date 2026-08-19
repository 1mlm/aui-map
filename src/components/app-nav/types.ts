import type { ReactNode } from "react"
import type { HugeIcon } from "@/components/Icon"

export type AppNavBrand = {
  iconSrc: string
  text: string
  subtext?: string
}

export type AppNavItem = {
  href: string
  label: string
  icon: HugeIcon
  countKey?: string
}

export type SheetFooterRenderer = (context: { open: boolean; close: () => void }) => ReactNode
