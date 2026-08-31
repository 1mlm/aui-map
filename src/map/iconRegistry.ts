import {
  Basketball01Icon,
  BedIcon,
  Building01Icon,
  Building02Icon,
  Car,
  Car05Icon,
  CircleParkingIcon,
  FootballIcon,
  ForkIcon,
  Home01Icon,
  Home09Icon,
  Key01Icon,
  Knife02Icon,
  Mic01Icon,
  MicVocalIcon,
  MoreIcon,
  OfficeIcon,
  PlazaIcon,
  Presentation01Icon,
  Restaurant02Icon,
  SparkleIcon,
  SportShoeIcon,
  SquareParkingIcon,
  StarIcon,
  TennisBallIcon,
  TheaterIcon,
} from "@hugeicons/core-free-icons"
import type { HugeIcon } from "@/components/Icon"

// a tag's icon is stored in the db as a key into this registry, since a HugeIcon's
// path data isn't something postgres can hold — adding a new tag icon means adding
// it here first, then it shows up in the admin's icon picker
//
// pins draw this icon inside the pin head at roughly 11px, so an icon only belongs here if it
// survives that: what matters is how many separate strokes (subpath `M` commands) it has, not
// its file size. StarIcon is 646 path chars in one continuous stroke and stays crisp;
// RestaurantIcon is 346 chars across 14 subpaths and turns to noise
//
// BedIcon/Car/FootballIcon/OfficeIcon/Restaurant02Icon/TheaterIcon are the busy ones the tags are
// being moved off of. They stay listed until the tag rows are actually switched over, because the
// db is shared with production — dropping a name a live Tag.icon still points at makes resolveIcon
// throw on every render and takes the whole map down
export const ICON_REGISTRY = {
  Basketball01Icon,
  BedIcon,
  Building01Icon,
  Building02Icon,
  Car,
  Car05Icon,
  CircleParkingIcon,
  FootballIcon,
  ForkIcon,
  Home01Icon,
  Home09Icon,
  Key01Icon,
  Knife02Icon,
  Mic01Icon,
  MicVocalIcon,
  MoreIcon,
  OfficeIcon,
  PlazaIcon,
  Presentation01Icon,
  Restaurant02Icon,
  SparkleIcon,
  SportShoeIcon,
  SquareParkingIcon,
  StarIcon,
  TennisBallIcon,
  TheaterIcon,
} satisfies Record<string, HugeIcon>

export type IconName = keyof typeof ICON_REGISTRY

export function resolveIcon(name: string): HugeIcon {
  const icon = (ICON_REGISTRY as Record<string, HugeIcon>)[name]
  if (!icon) throw new Error(`Unknown icon name: "${name}"`)
  return icon
}
