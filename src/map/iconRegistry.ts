import {
  BedIcon,
  Building06Icon,
  Car,
  ConstructionIcon,
  FootballIcon,
  MoreIcon,
  Restaurant02Icon,
  StarIcon,
  TheaterIcon,
} from "@hugeicons/core-free-icons"
import type { HugeIcon } from "@/components/Icon"

// a tag's icon is stored in the db as a key into this registry, since a HugeIcon's
// path data isn't something postgres can hold — adding a new tag icon means adding
// it here first, then it shows up in the admin's icon picker
export const ICON_REGISTRY = {
  BedIcon,
  Building06Icon,
  Car,
  ConstructionIcon,
  FootballIcon,
  MoreIcon,
  Restaurant02Icon,
  StarIcon,
  TheaterIcon,
} satisfies Record<string, HugeIcon>

export type IconName = keyof typeof ICON_REGISTRY

export function resolveIcon(name: string): HugeIcon {
  const icon = (ICON_REGISTRY as Record<string, HugeIcon>)[name]
  if (!icon) throw new Error(`Unknown icon name: "${name}"`)
  return icon
}
