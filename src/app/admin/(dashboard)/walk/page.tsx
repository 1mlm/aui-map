import type { Metadata } from "next"
import { WalkLogger } from "./WalkLogger"

export const metadata: Metadata = { title: "Walk" }

export default function AdminWalkPage() {
  return <WalkLogger />
}
