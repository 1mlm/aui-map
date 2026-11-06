import type { Metadata } from "next"
import { latLongToPosition } from "@/map/geo"
import { getCampusShapes } from "@/map/getCampusShapes"
import { getMapData } from "@/map/getMapData"
import { prisma } from "@/utils/prisma"
import { DrawingEditor } from "./DrawingEditor"

export const metadata: Metadata = { title: "Drawing" }
export const dynamic = "force-dynamic"

export default async function AdminDrawingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const [{ view }, shapes, pinRows, { items, tags }] = await Promise.all([
    searchParams,
    getCampusShapes(),
    prisma.pin.findMany({
      select: { id: true, title: true, latitude: true, longitude: true },
      orderBy: { title: "asc" },
    }),
    getMapData(),
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
  return <DrawingEditor initialView={view} {...{ shapes, pins, items, tags }} />
}
