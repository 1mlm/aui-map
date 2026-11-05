"use server"

import { revalidatePath } from "next/cache"
import { type CampusShapes, sanitizeShapes } from "@/map/campusShapes"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export async function saveCampusShapes(
  input: CampusShapes,
): Promise<{ error: string } | { ok: true }> {
  await requireAuth()
  const data = sanitizeShapes(input)
  if (!data)
    return { error: "Something in the drawing is invalid, nothing was saved." }

  // a link to a pin that doesn't exist is dropped rather than saved
  const pins = await prisma.pin.findMany({ select: { id: true } })
  const known = new Set(pins.map((pin) => pin.id))
  for (const building of data.buildings)
    if (building.id && !known.has(building.id)) delete building.id

  await prisma.campusMap.upsert({
    where: { id: 1 },
    update: { data },
    create: { id: 1, data },
  })
  // the public svg is cached like a static file, this rebuilds it
  revalidatePath("/campus-map.svg")
  revalidatePath("/admin/map")
  return { ok: true }
}
