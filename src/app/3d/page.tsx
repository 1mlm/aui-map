import { Suspense } from "react"
import { getMapData } from "@/map/getMapData"
import { Map3DExperience } from "@/map3d/Map3DExperience"

// same freshness story as the 2D map (src/app/page.tsx)
export const revalidate = 60

export default async function Page3D() {
  const { items } = await getMapData()

  return (
    <Suspense>
      <Map3DExperience {...{ items }} />
    </Suspense>
  )
}
