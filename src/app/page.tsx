import { Suspense } from "react"
import { getMapData } from "@/map/getMapData"
import { MapExperience } from "@/map/MapExperience"

// pins/tags rarely change — cheap time-based freshness here, plus admin mutations
// call revalidatePath("/") for instant freshness right after a save
export const revalidate = 60

export default async function Page() {
  const { items, tags } = await getMapData()

  return (
    <>
      <Suspense>
        <MapExperience {...{ items, tags }} />
      </Suspense>
      {/* the map is all client js, this gives crawlers (and screen readers) real text and a link to every place's own page */}
      <nav className="sr-only" aria-label="All places">
        <h1>Al Akhawayn University (Ifrane) campus map</h1>
        <ul>
          {items.map(({ id, title }) => (
            <li key={id}>
              <a href={`/${id}`}>{title}</a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
