import type { MetadataRoute } from "next"
import { getMapData } from "@/map/getMapData"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await getMapData()
  const pinPages = items.map(({ id, updatedAt }) => ({
    url: `https://auimap.ma/${id}`,
    lastModified: updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))

  return [
    {
      url: "https://auimap.ma",
      changeFrequency: "weekly",
      priority: 1,
    },
    ...pinPages,
  ]
}
