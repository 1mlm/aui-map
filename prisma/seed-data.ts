import type { IconName } from "@/map/iconRegistry"

// the one-time starting content for both the dev and prod databases — after the
// initial seed, each environment's data is edited independently through /admin
// smaller than 1 for things that sit inside/next to a building rather than being one — see
// Tag.sizeScale in prisma/schema.prisma
const SMALL_PIN_SCALE = 0.8

export const SEED_TAGS: {
  id: string
  label: string
  icon: IconName
  color: string | null
  sizeScale: number
}[] = [
  {
    id: "unknownHousing",
    label: "Housing",
    icon: "BedIcon",
    color: "indigo",
    sizeScale: 1,
  },
  {
    id: "food",
    label: "Food",
    icon: "Restaurant02Icon",
    color: "red",
    sizeScale: SMALL_PIN_SCALE,
  },
  {
    id: "sports",
    label: "Sports",
    icon: "FootballIcon",
    color: "green",
    sizeScale: SMALL_PIN_SCALE,
  },
  {
    id: "other",
    label: "Special",
    icon: "MoreIcon",
    color: "fuchsia",
    sizeScale: SMALL_PIN_SCALE,
  },
  { id: "parking", label: "Parking", icon: "Car", color: "grey", sizeScale: 1 },
  {
    id: "academic",
    label: "Academic",
    icon: "Building06Icon",
    color: "orange",
    sizeScale: 1,
  },
  {
    id: "auditorium",
    label: "Auditorium",
    icon: "TheaterIcon",
    color: "yellow",
    sizeScale: SMALL_PIN_SCALE,
  },
]

export const SEED_PINS: {
  id: string
  title: string
  aliases?: string[]
  description?: string
  tagId: string
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
    tagId: "academic",
    coord: "33.539911, -5.107359",
    attachmentCount: 2,
  },
  {
    id: "field",
    title: "AUI Sports Field",
    aliases: ["The Track", "Stade"],
    description:
      "Full-size grass pitch with a jogging track alongside. Currently under renovation.",
    tagId: "sports",
    coord: "33.540742, -5.108640",
  },
  { id: "b4", title: "B4", tagId: "academic", coord: "33.538956, -5.107404" },
  { id: "b8", title: "B8", tagId: "academic", coord: "33.538582, -5.107859" },
  {
    id: "b8b",
    title: "B 8/B",
    tagId: "academic",
    coord: "33.538249, -5.108226",
  },
  {
    id: "nab",
    title: "NAB",
    aliases: ["New Academic Building"],
    tagId: "academic",
    coord: "33.537733, -5.108550",
  },
  { id: "b16", title: "B16", tagId: "academic", coord: "33.538119, -5.108809" },
  {
    id: "b38",
    title: "B38",
    tagId: "unknownHousing",
    coord: "33.542242, -5.105322",
  },
  {
    id: "b39",
    title: "B39",
    tagId: "unknownHousing",
    coord: "33.542043, -5.104326",
  },
  {
    id: "proxy",
    title: "Proxyrest - Le Carré",
    aliases: ["Proxy", "Le Carré"],
    tagId: "food",
    coord: "33.540512, -5.107880",
  },
  {
    id: "health-center",
    title: "Health Center",
    description: "Campus clinic. Walk-ins welcome, open weekdays.",
    tagId: "other",
    coord: "33.540264, -5.105466",
  },
  {
    id: "pool",
    title: "Pool",
    aliases: ["Piscine"],
    description:
      "Indoor Olympic pool, 8 lanes, kept around 27 to 28°C year round. Open daily with lifeguards on duty.",
    tagId: "sports",
    coord: "33.539597, -5.109371",
  },
  {
    id: "gym",
    title: "Fitness Center",
    aliases: ["The Gym", "Salle de sport"],
    description:
      "Weight room, cardio room, and a table tennis room, right by the main field.",
    tagId: "sports",
    coord: "33.539916, -5.109399",
    attachmentCount: 2,
  },
  { id: "b11", title: "B11", tagId: "academic", coord: "33.539082, -5.108217" },
  { id: "b10", title: "B10", tagId: "academic", coord: "33.539269, -5.107897" },
  { id: "b5", title: "B5", tagId: "academic", coord: "33.538534, -5.107058" },
  { id: "b6", title: "B6", tagId: "academic", coord: "33.538262, -5.107262" },
  {
    id: "b7",
    title: "B7",
    description:
      "Mix of classrooms, labs, amphitheaters and professor offices. The first floor also houses the Writing Center for free help with English papers.",
    tagId: "academic",
    coord: "33.537796, -5.107795",
  },
  {
    id: "masjid",
    title: "AUI Masjid",
    aliases: ["Mosque", "Mosquée", "The Masjid"],
    description:
      "Campus mosque for the five daily prayers. Roughly central between the library and the academic buildings.",
    tagId: "other",
    coord: "33.539462, -5.106816",
  },
  { id: "b9", title: "B9", tagId: "other", coord: "33.538710, -5.108546" },
  {
    id: "shop",
    title: "Shop",
    aliases: ["Superette"],
    tagId: "food",
    coord: "33.538992, -5.106369",
  },
  { id: "cossa", title: "Cossa", tagId: "food", coord: "33.539169, -5.105565" },
  {
    id: "american-grill",
    title: "American Grill",
    aliases: ["American", "The Grill"],
    tagId: "food",
    coord: "33.539416, -5.105824",
  },
  {
    id: "linstant",
    title: "L'instant Cafeteria",
    aliases: ["Cafeteria", "L'instant", "Caf"],
    description: "The default lunch spot. Expect a line around noon.",
    tagId: "food",
    coord: "33.539231, -5.106101",
    attachmentCount: 3,
  },
  {
    id: "event-room",
    title: "Event room",
    tagId: "other",
    coord: "33.538845, -5.106575",
  },
  {
    id: "sao",
    title: "SAO Longue",
    aliases: ["SAO"],
    tagId: "other",
    coord: "33.540350, -5.108022",
  },
  {
    id: "b45",
    title: "B45",
    tagId: "unknownHousing",
    coord: "33.539038, -5.103492",
  },
  {
    id: "b51",
    title: "B51",
    tagId: "unknownHousing",
    coord: "33.541979, -5.106012",
  },
  {
    id: "scb",
    title: "Student Center Building",
    aliases: ["SCB", "Student Center"],
    tagId: "academic",
    coord: "33.540049, -5.105190",
    underConstruction: true,
  },
  {
    id: "business-office",
    title: "Business Office",
    description:
      "Issues and unblocks the Cash Wallet card. It's the only payment method accepted at campus dining.",
    tagId: "other",
    coord: "33.538962, -5.105741",
  },
  {
    id: "registrar",
    title: "Registrar's Office",
    aliases: ["Registrar"],
    description: "Registration, records, and enrollment paperwork.",
    tagId: "other",
    coord: "33.538582, -5.106164",
  },
  {
    id: "laundry",
    title: "Landromat",
    aliases: ["Laundry"],
    description:
      "Full-service basement laundry. Drop off your clothes and an attendant washes, dries, and folds them for you.",
    tagId: "other",
    coord: "33.541022, -5.107031",
  },
  {
    id: "b55",
    title: "B55",
    tagId: "unknownHousing",
    coord: "33.542249, -5.106503",
  },
  { id: "b14", title: "B14", tagId: "academic", coord: "33.540682, -5.108022" },
  {
    id: "padel",
    title: "Padel Court",
    aliases: ["Padel"],
    tagId: "sports",
    coord: "33.540829, -5.107835",
  },
  {
    id: "tennis-1",
    title: "Tennis Court 1",
    tagId: "sports",
    coord: "33.540559, -5.107647",
  },
  {
    id: "tennis-2",
    title: "Tennis Court 2",
    tagId: "sports",
    coord: "33.540258, -5.107835",
  },
  {
    id: "aud17",
    title: "AUD 17",
    aliases: ["Auditorium 17", "The Auditorium"],
    tagId: "auditorium",
    coord: "33.537688, -5.106573",
  },
  {
    id: "rond-point-18",
    title: "Rond point 18",
    aliases: ["Roundabout 18", "Rond-point"],
    tagId: "other",
    coord: "33.541246, -5.106640",
  },
  {
    id: "food-stand",
    title: "Food Stand",
    tagId: "food",
    coord: "33.541886, -5.105333",
  },
  {
    id: "b18",
    title: "B18",
    tagId: "unknownHousing",
    coord: "33.541379, -5.106918",
  },
  {
    id: "b19",
    title: "B19",
    tagId: "unknownHousing",
    coord: "33.541159, -5.107180",
  },
  {
    id: "b57",
    title: "B57",
    tagId: "unknownHousing",
    coord: "33.542751, -5.106217",
    underConstruction: true,
  },
  {
    id: "atm",
    title: "ATM",
    aliases: ["Guichet"],
    description:
      "Basement of Building 33. 4 ATMs, plus AUI's post office branch right next door.",
    tagId: "other",
    coord: "33.539215, -5.105056",
  },
  {
    id: "b29",
    title: "B29",
    tagId: "unknownHousing",
    coord: "33.539404, -5.104451",
  },
  {
    id: "b44",
    title: "B44",
    tagId: "unknownHousing",
    coord: "33.539841, -5.104466",
  },
  {
    id: "b41",
    title: "B41",
    tagId: "unknownHousing",
    coord: "33.540412, -5.104645",
  },
  {
    id: "b46",
    title: "B46",
    tagId: "unknownHousing",
    coord: "33.540929, -5.104242",
  },
  {
    id: "b27",
    title: "B27",
    tagId: "unknownHousing",
    coord: "33.541270, -5.104958",
  },
  {
    id: "b54",
    title: "B54",
    tagId: "unknownHousing",
    coord: "33.542296, -5.107281",
  },
  {
    id: "laundry-2",
    title: "Landromat 2",
    aliases: ["Laundry 2"],
    description: "Self-service washers and dryers, token operated.",
    tagId: "other",
    coord: "33.542867, -5.104251",
  },
  {
    id: "main-parking",
    title: "Main Parking",
    aliases: ["Parking"],
    tagId: "parking",
    coord: "33.537460, -5.105250",
  },
  {
    id: "opera",
    title: "L'Opera",
    aliases: ["Opera"],
    tagId: "auditorium",
    coord: "33.539872, -5.106423",
  },
  {
    id: "aud4",
    title: "AUD 4",
    aliases: ["Auditorium 4"],
    tagId: "auditorium",
    coord: "33.538865, -5.107484",
  },
  {
    id: "aud16",
    title: "AUD 16",
    aliases: ["Auditorium 16"],
    tagId: "auditorium",
    coord: "33.538207, -5.108821",
  },
  {
    id: "new-gym",
    title: "New Gym",
    tagId: "sports",
    coord: "33.540449, -5.109319",
  },
  {
    id: "aud7",
    title: "Auditorium 7",
    tagId: "auditorium",
    coord: "33.537921, -5.107921",
  },
  {
    id: "b42",
    title: "Building 42",
    aliases: ["B42"],
    tagId: "unknownHousing",
    coord: "33.540338, -5.104151",
  },
  {
    id: "47",
    title: "Building 47",
    aliases: ["B47"],
    tagId: "unknownHousing",
    coord: "33.540816, -5.104819",
  },
]
