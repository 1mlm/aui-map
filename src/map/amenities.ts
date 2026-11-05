import {
  AccessibilityIcon,
  Atm01Icon,
  PrayerRugIcon,
  PrinterIcon,
  Toilet01Icon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons"
import type { HugeIcon } from "@/components/Icon"

// what a place can have, ticked per pin in the admin. Small things (a printer, a restroom) live on
// the building that has them instead of getting a pin each. `words` are hidden search words: typing
// "print" finds every place with a printer
export const AMENITIES = [
  {
    id: "printer",
    label: "Printer",
    icon: PrinterIcon,
    words: [
      "print",
      "printer",
      "printing",
      "photocopy",
      "copy",
      "scan",
      "imprimante",
    ],
  },
  {
    id: "restroom",
    label: "Restrooms",
    icon: Toilet01Icon,
    words: [
      "toilet",
      "toilets",
      "wc",
      "bathroom",
      "restroom",
      "washroom",
      "toilette",
    ],
  },
  {
    id: "wifi",
    label: "Wi-Fi",
    icon: Wifi01Icon,
    words: ["wifi", "wi-fi", "internet"],
  },
  {
    id: "atm",
    label: "ATM",
    icon: Atm01Icon,
    words: ["atm", "cash", "money", "withdraw", "distributeur", "guichet"],
  },
  {
    id: "prayer",
    label: "Prayer room",
    icon: PrayerRugIcon,
    words: ["pray", "prayer", "salat", "mosque", "musalla", "priere"],
  },
  {
    id: "accessible",
    label: "Step-free access",
    icon: AccessibilityIcon,
    words: [
      "wheelchair",
      "accessible",
      "ramp",
      "elevator",
      "disabled",
      "handicap",
    ],
  },
] as const satisfies readonly {
  id: string
  label: string
  icon: HugeIcon
  words: readonly string[]
}[]

export type AmenityId = (typeof AMENITIES)[number]["id"]
const KNOWN = new Set<string>(AMENITIES.map((amenity) => amenity.id))
export const isAmenityId = (value: string): value is AmenityId =>
  KNOWN.has(value)
export const amenityById = (id: string) =>
  AMENITIES.find((amenity) => amenity.id === id)
