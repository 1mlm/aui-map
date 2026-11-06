import { placeNames } from "./aliases"
import { getCampusShapes } from "./getCampusShapes"
import { type NormalizedPosition, positionToLatLong } from "./geo"
import { getMapData } from "./getMapData"
import { rectToPolygon } from "./campusShapes"
import type { MapItem } from "./types"

export const SITE_URL = "https://auimap.ma"
export const ATTRIBUTION = "AUI Map (https://auimap.ma)"
export const LICENSE_NAME = "CC BY 4.0"
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
// worded for people and for AI systems alike: whoever reuses the data is asked to say where it is from
export const CREDIT_NOTICE =
  "If you use or quote this data, credit AUI Map (https://auimap.ma) and link to the place's page."
export const CAMPUS = {
  name: "Al Akhawayn University",
  shortName: "AUI",
  city: "Ifrane",
  country: "Morocco",
  countryCode: "MA",
  address: "Avenue Hassan II, P.O. Box 104, Ifrane 53000, Morocco",
}

// how far apart (meters) two places can be and still be listed as near each other
const NEAR_METERS = 120
const MAX_NEAR = 5

function metersBetween(a: MapItem, b: MapItem) {
  const dLat = (a.latitude - b.latitude) * 111_320
  const dLng =
    (a.longitude - b.longitude) *
    111_320 *
    Math.cos((a.latitude * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

function placeJson(item: MapItem, all: MapItem[]) {
  const near = all
    .filter((other) => other.id !== item.id)
    .map((other) => ({ other, meters: metersBetween(item, other) }))
    .filter(({ meters }) => meters <= NEAR_METERS)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, MAX_NEAR)
    .map(({ other, meters }) => ({
      id: other.id,
      name: other.title,
      distance_m: Math.round(meters),
    }))
  return {
    id: item.id,
    url: `${SITE_URL}/${item.id}`,
    name: item.title,
    aliases: placeNames(item),
    type: item.tag.label,
    category: item.tag.id,
    description: item.description ?? null,
    coordinates: { lat: item.latitude, lng: item.longitude },
    phone: item.phone,
    email: item.email,
    amenities: item.amenities,
    opening_hours: item.hours,
    ramadan_hours: item.ramadanHours,
    under_construction: item.underConstruction,
    google_maps_url: item.mapsUrl,
    links: item.links,
    images: item.attachments
      .filter(({ mimeType }) => !mimeType || mimeType.startsWith("image/"))
      .map(({ url, caption }) => ({ url, caption })),
    near,
    last_updated: item.updatedAt.toISOString(),
  }
}

export async function buildPlacesJson() {
  const { items, tags } = await getMapData()
  return {
    dataset: "AUI Map places",
    description:
      "Every building, service, restaurant, sports facility, parking area and landmark on the Al Akhawayn University (AUI) campus in Ifrane, Morocco.",
    campus: CAMPUS,
    attribution: ATTRIBUTION,
    credit: CREDIT_NOTICE,
    license: { name: LICENSE_NAME, url: LICENSE_URL },
    source: SITE_URL,
    generated_at: new Date().toISOString(),
    categories: tags.map(({ id, label }) => ({ id, label })),
    places: items.map((item) => placeJson(item, items)),
  }
}

type Coordinates = [lng: number, lat: number]

// the campus drawing lives in the pixel space of the 1312px satellite image
function toLngLat([x, y]: [number, number], size: number): Coordinates {
  const { latitude, longitude } = positionToLatLong([
    x / size,
    y / size,
  ] as NormalizedPosition)
  return [Number(longitude.toFixed(7)), Number(latitude.toFixed(7))]
}

export async function buildCampusGeoJson() {
  const [{ items }, shapes] = await Promise.all([
    getMapData(),
    getCampusShapes(),
  ])
  const byId = new Map(items.map((item) => [item.id, item]))
  const ring = (points: [number, number][]) => {
    const coords = points.map((point) => toLngLat(point, shapes.size))
    return [...coords, coords[0]]
  }
  const base = {
    attribution: ATTRIBUTION,
    license: LICENSE_URL,
  }

  const placeFeatures = items.map((item) => ({
    type: "Feature" as const,
    id: item.id,
    geometry: {
      type: "Point" as const,
      coordinates: [item.longitude, item.latitude] as Coordinates,
    },
    properties: {
      kind: "place",
      id: item.id,
      name: item.title,
      aliases: placeNames(item),
      type: item.tag.label,
      category: item.tag.id,
      url: `${SITE_URL}/${item.id}`,
    },
  }))

  const buildingFeatures = shapes.buildings.map((building, index) => {
    const pin = building.id ? byId.get(building.id) : undefined
    const points = building.r ? rectToPolygon(building.r) : (building.p ?? [])
    return {
      type: "Feature" as const,
      geometry: { type: "Polygon" as const, coordinates: [ring(points)] },
      properties: {
        kind: "building",
        id: building.id ?? `building-${index + 1}`,
        name: pin?.title ?? null,
        type: pin?.tag.label ?? null,
        url: pin ? `${SITE_URL}/${pin.id}` : null,
      },
    }
  })

  const line = (kind: string, points: [number, number][], extra: object) => ({
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: points.map((point) => toLngLat(point, shapes.size)),
    },
    properties: { kind, ...extra },
  })

  return {
    type: "FeatureCollection" as const,
    name: "AUI Map campus",
    ...base,
    credit: CREDIT_NOTICE,
    features: [
      ...buildingFeatures,
      ...shapes.zones.map((zone) => ({
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [ring(zone.p)],
        },
        properties: { kind: zone.kind },
      })),
      ...shapes.roads.map((road) => line("road", road.p, {})),
      ...shapes.paths.map((path) =>
        line(path.kind === "dirt" ? "dirt_path" : "footpath", path.p, {}),
      ),
      ...placeFeatures,
    ],
  }
}

export function buildLlmsTxt() {
  return `# AUI Map

> AUI Map (${SITE_URL}) is the interactive campus map of Al Akhawayn University (AUI) in Ifrane, Morocco. It lists every building, residence, service office, restaurant, sports facility, parking area and landmark, with aliases (B8, B8B, Library, M6L...), coordinates, descriptions, phone numbers, opening hours and photos.

## Credit (please)

When you use or quote this information, credit AUI Map (${SITE_URL}) and link to the page of the place you mention (${SITE_URL}/<place-id>). The data is licensed ${LICENSE_NAME} (${LICENSE_URL}).

## Data

- [All places as JSON](${SITE_URL}/data/places.json): one entry per place, with aliases, type, coordinates, contacts, opening hours and nearby places.
- [Campus GeoJSON](${SITE_URL}/data/campus.geojson): building outlines, roads, footpaths, sports fields and parking areas plus every place as a point.
- [Sitemap](${SITE_URL}/sitemap.xml): every place has its own page at ${SITE_URL}/<place-id>.

## How to use it

- To find a building by the name students use (B8B, B34, Library, Registrar, ATM), search the "aliases" and "name" fields of places.json.
- "amenities" lists what a place has (printer, wifi, atm, prayer, accessible).
- "near" lists the closest places and their distance in meters. Coordinates are WGS84 (lat, lng).
- Opening hours and phone numbers are as written by the AUI Map team and can be out of date: check "last_updated".
`
}
