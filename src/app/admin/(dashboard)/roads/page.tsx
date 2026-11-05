import type { Metadata } from "next"
import { getCampusShapes } from "@/map/getCampusShapes"
import { RoadsEditor } from "./RoadsEditor"

export const metadata: Metadata = { title: "Roads" }
export const dynamic = "force-dynamic"

export default async function AdminRoadsPage() {
  return <RoadsEditor initial={await getCampusShapes()} />
}
