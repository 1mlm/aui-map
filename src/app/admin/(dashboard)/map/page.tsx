import type { Metadata } from "next"
import { latLongToPosition } from "@/map/geo"
import { getCampusShapes } from "@/map/getCampusShapes"
import { prisma } from "@/utils/prisma"
import { MapEditor } from "./MapEditor"

export const metadata: Metadata = { title: "Campus drawing" }
export const dynamic = "force-dynamic"

export default async function AdminMapPage() {
  const [shapes, pinRows] = await Promise.all([
    getCampusShapes(),
    prisma.pin.findMany({
      select: { id: true, title: true, latitude: true, longitude: true },
      orderBy: { title: "asc" },
    }),
  ])
  const pins = pinRows.map((pin) => {
    const [x, y] = latLongToPosition(pin.latitude, pin.longitude)
    return {
      id: pin.id,
      title: pin.title,
      x: x * shapes.size,
      y: y * shapes.size,
    }
  })
  return <MapEditor initial={shapes} pins={pins} />
}
