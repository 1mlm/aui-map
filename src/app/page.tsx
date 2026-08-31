import { Suspense } from "react"
import { getMapData } from "@/map/getMapData"
import { MapExperience } from "@/map/MapExperience"

// pins/tags rarely change — cheap time-based freshness here, plus admin mutations
// call revalidatePath("/") for instant freshness right after a save
export const revalidate = 60

export default async function Page() {
  const { items, tags, panoramas } = await getMapData()

  return (
    <Suspense>
      <MapExperience {...{ items, tags, panoramas }} />
    </Suspense>
  )
}
