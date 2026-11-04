import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache, Suspense } from "react"
import { getMapData } from "@/map/getMapData"
import { MapExperience } from "@/map/MapExperience"
import type { MapItem } from "@/map/types"

// same cadence as the home page, plus revalidatePath("/[pinId]", "page") in the admin actions
export const revalidate = 60

// generateMetadata and the page both need the data, cache() makes it one query per request
const getMapDataOncePerRequest = cache(getMapData)

type PageProps = { params: Promise<{ pinId: string }> }

export async function generateStaticParams() {
  const { items } = await getMapDataOncePerRequest()
  return items.map(({ id }) => ({ pinId: id }))
}

async function getPinPageData({ params }: PageProps) {
  const { pinId } = await params
  const { items, tags } = await getMapDataOncePerRequest()
  const pin = items.find((item) => item.id === pinId)
  if (!pin) notFound()
  return { pin, items, tags }
}

// what each category is, in plain words. Only used when a pin has no hand-written description,
// so every pin page still gets a real sentence for the meta description / search snippet
const TAG_NOUNS: Record<string, string> = {
  building: "general building",
  unknownHousing: "student housing building",
  auditorium: "auditorium",
  food: "place to eat",
  sports: "sports facility",
  parking: "parking area",
  service: "campus service",
  other: "point of interest",
}

function getPinDescription(pin: MapItem) {
  const where = `${pin.title} at Al Akhawayn University, Ifrane, Morocco.`
  // admin descriptions are multi-line, a meta description is one line
  const written = pin.description?.replace(/\s+/g, " ").trim()
  if (written) return `${where} ${written}`

  const noun = TAG_NOUNS[pin.tag.id] ?? "place"
  const facts = [
    `${pin.title} is a ${noun} on the Al Akhawayn University campus.`,
    pin.hours && `Opening hours: ${pin.hours}.`,
    pin.phone && `Phone: ${pin.phone}.`,
    "See its exact location on the AUI campus map.",
  ]
  return [where, ...facts].filter(Boolean).join(" ")
}

function getPinThumbnailUrl(pin: MapItem) {
  const thumbnail = pin.attachments.find(
    ({ mimeType }) => !mimeType || mimeType.startsWith("image/"),
  )
  return thumbnail?.url
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { pin } = await getPinPageData(props)
  const description = getPinDescription(pin)
  const thumbnailUrl = getPinThumbnailUrl(pin)
  const title = `${pin.title} (${pin.tag.label}) at Al Akhawayn University`

  return {
    title,
    description,
    alternates: { canonical: `/${pin.id}` },
    openGraph: {
      title,
      description,
      url: `/${pin.id}`,
      siteName: "AUI Map",
      locale: "en_US",
      type: "website",
      ...(thumbnailUrl && { images: [thumbnailUrl] }),
    },
  }
}

function getPinStructuredData(pin: MapItem) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: pin.title,
    alternateName: pin.aliases,
    description: getPinDescription(pin),
    url: `https://auimap.ma/${pin.id}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: pin.latitude,
      longitude: pin.longitude,
    },
    image: pin.attachments.map(({ url }) => url),
    telephone: pin.phone ?? undefined,
    containedInPlace: {
      "@type": "CollegeOrUniversity",
      name: "Al Akhawayn University",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ifrane",
        addressCountry: "MA",
      },
    },
  }
}

export default async function Page(props: PageProps) {
  const { pin, items, tags } = await getPinPageData(props)
  const structuredData = JSON.stringify(getPinStructuredData(pin)).replaceAll(
    "<",
    "\\u003c",
  )

  return (
    <>
      <Suspense>
        <MapExperience initialSelectedId={pin.id} {...{ items, tags }} />
      </Suspense>
      {/* the map itself is all client js, this is what a crawler (or a screen reader) actually reads */}
      <article className="sr-only">
        <h1>{pin.title}</h1>
        <p>{getPinDescription(pin)}</p>
        {pin.hours && <p>Opening hours: {pin.hours}</p>}
        {pin.phone && <p>Phone: {pin.phone}</p>}
        {pin.email && <p>Email: {pin.email}</p>}
        <a href="/">Back to the AUI campus map</a>
      </article>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: json-ld has to be raw script text, "<" is escaped above
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
    </>
  )
}
