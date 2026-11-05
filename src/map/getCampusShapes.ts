import { prisma } from "@/utils/prisma"
import {
  BUNDLED_SHAPES,
  type CampusShapes,
  sanitizeShapes,
} from "./campusShapes"

// the saved campus from the db, or the one bundled with the code until the first save (and if the
// db can't be reached, so a hiccup never blanks the map)
export async function getCampusShapes(): Promise<CampusShapes> {
  try {
    const row = await prisma.campusMap.findUnique({ where: { id: 1 } })
    return sanitizeShapes(row?.data) ?? BUNDLED_SHAPES
  } catch {
    return BUNDLED_SHAPES
  }
}
