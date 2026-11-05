import { buildPlacesJson, CREDIT_NOTICE } from "@/map/publicData"

// served like a static file, rebuilt at most once an hour
export const revalidate = 3600

export async function GET() {
  return Response.json(await buildPlacesJson(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "X-Credit": CREDIT_NOTICE,
      Link: '<https://creativecommons.org/licenses/by/4.0/>; rel="license"',
    },
  })
}
