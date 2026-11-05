import { buildCampusGeoJson, CREDIT_NOTICE } from "@/map/publicData"

export const revalidate = 3600

export async function GET() {
  return new Response(JSON.stringify(await buildCampusGeoJson()), {
    headers: {
      "Content-Type": "application/geo+json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "X-Credit": CREDIT_NOTICE,
      Link: '<https://creativecommons.org/licenses/by/4.0/>; rel="license"',
    },
  })
}
