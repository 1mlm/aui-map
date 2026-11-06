import type { Metadata } from "next"
import { getCampusShapes } from "@/map/getCampusShapes"
import { getMapData } from "@/map/getMapData"
import { MapImageMaker } from "./MapImageMaker"

export const metadata: Metadata = { title: "Map image" }
export const dynamic = "force-dynamic"

export default async function AdminMapImagePage() {
  const [{ items, tags }, shapes] = await Promise.all([
    getMapData(),
    getCampusShapes(),
  ])
  return <MapImageMaker {...{ items, tags, shapes }} />
}
