import { buildCampusSvg } from "@/map/campusShapes"
import { getCampusShapes } from "@/map/getCampusShapes"
import { prisma } from "@/utils/prisma"

// served like a static file (built once, rebuilt when /admin/map saves, or after an hour)
export const revalidate = 3600

export async function GET() {
  const shapes = await getCampusShapes()
  let tagByPinId: Record<string, string> = {}
  try {
    const pins = await prisma.pin.findMany({
      select: { id: true, tagId: true },
    })
    tagByPinId = Object.fromEntries(pins.map((pin) => [pin.id, pin.tagId]))
  } catch {}
  return new Response(buildCampusSvg(shapes, tagByPinId), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control":
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
