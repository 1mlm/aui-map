import type { Metadata } from "next"
import { getMapData } from "@/map/getMapData"
import { MapImageMaker } from "./MapImageMaker"

export const metadata: Metadata = { title: "Map image" }
export const dynamic = "force-dynamic"

export default async function AdminMapImagePage() {
  const { items, tags } = await getMapData()
  return <MapImageMaker {...{ items, tags }} />
}
