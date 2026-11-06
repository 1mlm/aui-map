"use server"

import { revalidatePath } from "next/cache"
import { type CampusShapes, sanitizeShapes } from "@/map/campusShapes"
import { getCampusShapes } from "@/map/getCampusShapes"
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

  // this editor only draws buildings: roads, paths and zones are drawn in /admin/roads, so what is
  // saved there is kept instead of being overwritten by a page that was opened before it
  const current = await getCampusShapes()
  data.roads = current.roads
  data.paths = current.paths
  data.zones = current.zones
  data.roundabouts = current.roundabouts
  await saveRow(data)
  return { ok: true }
}

// roads, footpaths and zones from /admin/roads. The buildings saved in /admin/map are kept
export async function saveCampusLines(
  input: Pick<CampusShapes, "roads" | "paths" | "zones" | "roundabouts">,
): Promise<{ error: string } | { ok: true }> {
  await requireAuth()
  const current = await getCampusShapes()
  const data = sanitizeShapes({ ...current, ...input })
  if (!data)
    return { error: "Something in the drawing is invalid, nothing was saved." }
  await saveRow(data)
  return { ok: true }
}

async function saveRow(data: CampusShapes) {
  await prisma.campusMap.upsert({
    where: { id: 1 },
    update: { data },
    create: { id: 1, data },
  })
  // the public svg is cached like a static file, this rebuilds it
  revalidatePath("/campus-map.svg")
  revalidatePath("/admin/map")
  revalidatePath("/admin/drawing")
  revalidatePath("/admin/drawing")
  revalidatePath("/data/campus.geojson")
}
