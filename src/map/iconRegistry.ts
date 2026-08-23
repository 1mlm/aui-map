import {
  BedIcon,
  Blockchain01Icon,
  Building06Icon,
  Car,
  ConstructionIcon,
  CorporateIcon,
  DepartementIcon,
  Door01Icon,
  Door02Icon,
  DoorClosedIcon,
  DoorClosedLockedIcon,
  DoorIcon,
  DoorLockIcon,
  DoorOpenIcon,
  FootballIcon,
  Home01Icon,
  Home02Icon,
  Home03Icon,
  Home04Icon,
  Home05Icon,
  Home06Icon,
  Home07Icon,
  Home08Icon,
  Home09Icon,
  Home10Icon,
  Home11Icon,
  Home12Icon,
  Home13Icon,
  Key01Icon,
  Key02Icon,
  MoreIcon,
  OfficeIcon,
  Restaurant02Icon,
  SchoolIcon,
  StarIcon,
  TheaterIcon,
} from "@hugeicons/core-free-icons"
import type { HugeIcon } from "@/components/Icon"

// a tag's icon is stored in the db as a key into this registry, since a HugeIcon's
// path data isn't something postgres can hold — adding a new tag icon means adding
// it here first, then it shows up in the admin's icon picker
export const ICON_REGISTRY = {
  BedIcon,
  Blockchain01Icon,
  Building06Icon,
  Car,
  ConstructionIcon,
  CorporateIcon,
  DepartementIcon,
  Door01Icon,
  Door02Icon,
  DoorClosedIcon,
  DoorClosedLockedIcon,
  DoorIcon,
  DoorLockIcon,
  DoorOpenIcon,
  FootballIcon,
  Home01Icon,
  Home02Icon,
  Home03Icon,
  Home04Icon,
  Home05Icon,
  Home06Icon,
  Home07Icon,
  Home08Icon,
  Home09Icon,
  Home10Icon,
  Home11Icon,
  Home12Icon,
  Home13Icon,
  Key01Icon,
  Key02Icon,
  MoreIcon,
  OfficeIcon,
  Restaurant02Icon,
  SchoolIcon,
  StarIcon,
  TheaterIcon,
} satisfies Record<string, HugeIcon>

export type IconName = keyof typeof ICON_REGISTRY

export function resolveIcon(name: string): HugeIcon {
  const icon = (ICON_REGISTRY as Record<string, HugeIcon>)[name]
  if (!icon) throw new Error(`Unknown icon name: "${name}"`)
  return icon
}
