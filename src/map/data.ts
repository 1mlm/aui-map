import {
  BedIcon,
  Building06Icon,
  Car,
  FootballIcon,
  MoreIcon,
  Restaurant02Icon,
  TheaterIcon,
} from "@hugeicons/core-free-icons"
import { parseCoordinates } from "./geo"
import type { MapItem, MapItemTag } from "./types"

const SMALL_PIN_SCALE = 0.8

export const MAP_TAGS = {
  unknownHousing: {
    id: "unknownHousing",
    label: "Housing",
    icon: BedIcon,
    color: "indigo",
    sizeScale: 1,
  },
  food: {
    id: "food",
    label: "Food",
    icon: Restaurant02Icon,
    color: "red",
    sizeScale: SMALL_PIN_SCALE,
  },
  sports: {
    id: "sports",
    label: "Sports",
    icon: FootballIcon,
    color: "green",
    sizeScale: SMALL_PIN_SCALE,
  },
  other: {
    id: "other",
    label: "Special",
    icon: MoreIcon,
    color: "fuchsia",
    sizeScale: SMALL_PIN_SCALE,
  },
  parking: {
    id: "parking",
    label: "Parking",
    icon: Car,
    color: "grey",
    sizeScale: 1,
  },
  academic: {
    id: "academic",
    label: "Academic",
    icon: Building06Icon,
    color: "orange",
    sizeScale: 1,
  },
  auditorium: {
    id: "auditorium",
    label: "Auditorium",
    icon: TheaterIcon,
    color: "yellow",
    sizeScale: SMALL_PIN_SCALE,
  },
} satisfies Record<string, MapItemTag>

type TagId = keyof typeof MAP_TAGS

const rawMapItems: {
  // short readable handle, and the value of the ?focus= query param that opens this item
  id: string
  title: string
  aliases?: string[]
  description?: string
  tag: TagId
  // exactly what you'd copy out of Google Maps, "latitude, longitude"
  coord: string
  attachmentCount?: number
  underConstruction?: boolean
}[] = [
  {
    id: "m6l",
    title: "Mohammed VI Library",
    aliases: ["M6L", "The Library", "Bibliothèque"],
    description:
      "Main campus library. Study floors, group rooms, and wifi that covers the whole building. Stays open past midnight most nights, later during midterms, and 24/7 during finals.",
    tag: "academic",
    coord: "33.539911, -5.107359",
    attachmentCount: 2,
  },
  {
    id: "field",
    title: "AUI Sports Field",
    aliases: ["The Track", "Stade"],
    description:
      "Full-size grass pitch with a jogging track alongside. Currently under renovation.",
    tag: "sports",
    coord: "33.540742, -5.108640",
  },
  { id: "b4", title: "B4", tag: "academic", coord: "33.538956, -5.107404" },
  { id: "b8", title: "B8", tag: "academic", coord: "33.538582, -5.107859" },
  { id: "b8b", title: "B 8/B", tag: "academic", coord: "33.538249, -5.108226" },
  {
    id: "nab",
    title: "NAB",
    aliases: ["New Academic Building"],
    tag: "academic",
    coord: "33.537733, -5.108550",
  },
  { id: "b16", title: "B16", tag: "academic", coord: "33.538119, -5.108809" },
  {
    id: "b38",
    title: "B38",
    tag: "unknownHousing",
    coord: "33.542242, -5.105322",
  },
  {
    id: "b39",
    title: "B39",
    tag: "unknownHousing",
    coord: "33.542043, -5.104326",
  },
  {
    id: "proxy",
    title: "Proxyrest - Le Carré",
    aliases: ["Proxy", "Le Carré"],
    tag: "food",
    coord: "33.540512, -5.107880",
  },
  {
    id: "health-center",
    title: "Health Center",
    description: "Campus clinic. Walk-ins welcome, open weekdays.",
    tag: "other",
    coord: "33.540264, -5.105466",
  },
  {
    id: "pool",
    title: "Pool",
    aliases: ["Piscine"],
    description:
      "Indoor Olympic pool, 8 lanes, kept around 27 to 28°C year round. Open daily with lifeguards on duty.",
    tag: "sports",
    coord: "33.539597, -5.109371",
  },
  {
    id: "gym",
    title: "Fitness Center",
    aliases: ["The Gym", "Salle de sport"],
    description:
      "Weight room, cardio room, and a table tennis room, right by the main field.",
    tag: "sports",
    coord: "33.539916, -5.109399",
    attachmentCount: 2,
  },
  { id: "b11", title: "B11", tag: "academic", coord: "33.539082, -5.108217" },
  { id: "b10", title: "B10", tag: "academic", coord: "33.539269, -5.107897" },
  { id: "b5", title: "B5", tag: "academic", coord: "33.538534, -5.107058" },
  { id: "b6", title: "B6", tag: "academic", coord: "33.538262, -5.107262" },
  {
    id: "b7",
    title: "B7",
    description:
      "Mix of classrooms, labs, amphitheaters and professor offices. The first floor also houses the Writing Center for free help with English papers.",
    tag: "academic",
    coord: "33.537796, -5.107795",
  },
  {
    id: "masjid",
    title: "AUI Masjid",
    aliases: ["Mosque", "Mosquée", "The Masjid"],
    description:
      "Campus mosque for the five daily prayers. Roughly central between the library and the academic buildings.",
    tag: "other",
    coord: "33.539462, -5.106816",
  },
  { id: "b9", title: "B9", tag: "other", coord: "33.538710, -5.108546" },
  {
    id: "shop",
    title: "Shop",
    aliases: ["Superette"],
    tag: "food",
    coord: "33.538992, -5.106369",
  },
  { id: "cossa", title: "Cossa", tag: "food", coord: "33.539169, -5.105565" },
  {
    id: "american-grill",
    title: "American Grill",
    aliases: ["American", "The Grill"],
    tag: "food",
    coord: "33.539416, -5.105824",
  },
  {
    id: "linstant",
    title: "L'instant Cafeteria",
    aliases: ["Cafeteria", "L'instant", "Caf"],
    description: "The default lunch spot. Expect a line around noon.",
    tag: "food",
    coord: "33.539231, -5.106101",
    attachmentCount: 3,
  },
  {
    id: "event-room",
    title: "Event room",
    tag: "other",
    coord: "33.538845, -5.106575",
  },
  {
    id: "sao",
    title: "SAO Longue",
    aliases: ["SAO"],
    tag: "other",
    coord: "33.540350, -5.108022",
  },
  {
    id: "b45",
    title: "B45",
    tag: "unknownHousing",
    coord: "33.539038, -5.103492",
  },
  {
    id: "b51",
    title: "B51",
    tag: "unknownHousing",
    coord: "33.541979, -5.106012",
  },
  {
    id: "scb",
    title: "Student Center Building",
    aliases: ["SCB", "Student Center"],
    tag: "academic",
    coord: "33.540049, -5.105190",
    underConstruction: true,
  },
  {
    id: "business-office",
    title: "Business Office",
    description:
      "Issues and unblocks the Cash Wallet card. It's the only payment method accepted at campus dining.",
    tag: "other",
    coord: "33.538962, -5.105741",
  },
  {
    id: "registrar",
    title: "Registrar's Office",
    aliases: ["Registrar"],
    description: "Registration, records, and enrollment paperwork.",
    tag: "other",
    coord: "33.538582, -5.106164",
  },
  {
    id: "laundry",
    title: "Landromat",
    aliases: ["Laundry"],
    description:
      "Full-service basement laundry. Drop off your clothes and an attendant washes, dries, and folds them for you.",
    tag: "other",
    coord: "33.541022, -5.107031",
  },
  {
    id: "b55",
    title: "B55",
    tag: "unknownHousing",
    coord: "33.542249, -5.106503",
  },
  { id: "b14", title: "B14", tag: "academic", coord: "33.540682, -5.108022" },
  {
    id: "padel",
    title: "Padel Court",
    aliases: ["Padel"],
    tag: "sports",
    coord: "33.540829, -5.107835",
  },
  {
    id: "tennis-1",
    title: "Tennis Court 1",
    tag: "sports",
    coord: "33.540559, -5.107647",
  },
  {
    id: "tennis-2",
    title: "Tennis Court 2",
    tag: "sports",
    coord: "33.540258, -5.107835",
  },
  {
    id: "aud17",
    title: "AUD 17",
    aliases: ["Auditorium 17", "The Auditorium"],
    tag: "auditorium",
    coord: "33.537688, -5.106573",
  },
  {
    id: "rond-point-18",
    title: "Rond point 18",
    aliases: ["Roundabout 18", "Rond-point"],
    tag: "other",
    coord: "33.541246, -5.106640",
  },
  {
    id: "food-stand",
    title: "Food Stand",
    tag: "food",
    coord: "33.541886, -5.105333",
  },
  {
    id: "b18",
    title: "B18",
    tag: "unknownHousing",
    coord: "33.541379, -5.106918",
  },
  {
    id: "b19",
    title: "B19",
    tag: "unknownHousing",
    coord: "33.541159, -5.107180",
  },
  {
    id: "b57",
    title: "B57",
    tag: "unknownHousing",
    coord: "33.542751, -5.106217",
    underConstruction: true,
  },
  {
    id: "atm",
    title: "ATM",
    aliases: ["Guichet"],
    description:
      "Basement of Building 33. 4 ATMs, plus AUI's post office branch right next door.",
    tag: "other",
    coord: "33.539215, -5.105056",
  },
  {
    id: "b29",
    title: "B29",
    tag: "unknownHousing",
    coord: "33.539404, -5.104451",
  },
  {
    id: "b44",
    title: "B44",
    tag: "unknownHousing",
    coord: "33.539841, -5.104466",
  },
  {
    id: "b41",
    title: "B41",
    tag: "unknownHousing",
    coord: "33.540412, -5.104645",
  },
  {
    id: "b46",
    title: "B46",
    tag: "unknownHousing",
    coord: "33.540929, -5.104242",
  },
  {
    id: "b27",
    title: "B27",
    tag: "unknownHousing",
    coord: "33.541270, -5.104958",
  },
  {
    id: "b54",
    title: "B54",
    tag: "unknownHousing",
    coord: "33.542296, -5.107281",
  },
  {
    id: "laundry-2",
    title: "Landromat 2",
    aliases: ["Laundry 2"],
    description: "Self-service washers and dryers, token operated.",
    tag: "other",
    coord: "33.542867, -5.104251",
  },
  {
    id: "main-parking",
    title: "Main Parking",
    aliases: ["Parking"],
    tag: "parking",
    coord: "33.537460, -5.105250",
  },
  {
    id: "opera",
    title: "L'Opera",
    aliases: ["Opera"],
    tag: "auditorium",
    coord: "33.539872, -5.106423",
  },
  {
    id: "aud4",
    title: "AUD 4",
    aliases: ["Auditorium 4"],
    tag: "auditorium",
    coord: "33.538865, -5.107484",
  },
  {
    id: "aud16",
    title: "AUD 16",
    aliases: ["Auditorium 16"],
    tag: "auditorium",
    coord: "33.538207, -5.108821",
  },
  {
    id: "new-gym",
    title: "New Gym",
    tag: "sports",
    coord: "33.540449, -5.109319",
  },
  {
    id: "aud7",
    title: "Auditorium 7",
    tag: "auditorium",
    coord: "33.537921, -5.107921",
  },
  {
    id: "b42",
    title: "Building 42",
    aliases: ["B42"],
    tag: "unknownHousing",
    coord: "33.540338, -5.104151",
  },
  {
    id: "47",
    title: "Building 47",
    aliases: ["B47"],
    tag: "unknownHousing",
    coord: "33.540816, -5.104819",
  },
]

const getShortestName = (names: string[]) =>
  names.reduce((shortest, name) =>
    name.length < shortest.length ? name : shortest,
  )

export const MAP_ITEMS: MapItem[] = rawMapItems.map(
  ({
    id,
    title,
    aliases = [],
    description,
    tag,
    coord,
    attachmentCount,
    underConstruction = false,
  }) => ({
    id,
    title,
    aliases,
    shortestName: getShortestName([title, ...aliases]),
    description,
    mapsUrl: null,
    hours: null,
    ramadanHours: null,
    phone: null,
    email: null,
    links: [],
    tag: MAP_TAGS[tag],
    underConstruction,
    updatedAt: new Date(),
    attachments: Array.from({ length: attachmentCount ?? 0 }, (_, i) => ({
      id: `${id}-${i}`,
      url: "/auimap.webp",
      caption: null,
      mimeType: null,
      fileName: null,
      postedAt: new Date(),
    })),
    ...parseCoordinates(coord),
  }),
)

// the filter bar offers every tag in use, in the order they're declared above
export const MAP_FILTER_TAGS = (Object.keys(MAP_TAGS) as TagId[])
  .filter((id) => MAP_ITEMS.some((item) => item.tag.id === id))
  .map((id) => MAP_TAGS[id])
