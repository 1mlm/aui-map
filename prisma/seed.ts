import { PrismaPg } from "@prisma/adapter-pg"
import { parseCoordinates } from "../src/map/geo"
import { PrismaClient } from "../src/generated/prisma/client"
import { SEED_PINS, SEED_TAGS } from "./seed-data"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function seedTags() {
  for (const tag of SEED_TAGS) {
    await prisma.tag.upsert({ where: { id: tag.id }, create: tag, update: tag })
  }
}

async function seedPins() {
  for (const pin of SEED_PINS) {
    const { latitude, longitude } = parseCoordinates(pin.coord)
    const shared = {
      title: pin.title,
      aliases: pin.aliases ?? [],
      description: pin.description,
      latitude,
      longitude,
      tagId: pin.tagId,
      underConstruction: pin.underConstruction ?? false,
    }
    await prisma.pin.upsert({
      where: { id: pin.id },
      create: {
        id: pin.id,
        ...shared,
        attachments: pin.attachmentCount
          ? {
              create: Array.from({ length: pin.attachmentCount }, (_, i) => ({
                url: "/auimap.webp",
                isThumbnail: i === 0,
              })),
            }
          : undefined,
      },
      update: shared,
    })
  }
}

async function main() {
  await seedTags()
  await seedPins()
  console.log(`Seeded ${SEED_TAGS.length} tags and ${SEED_PINS.length} pins`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
