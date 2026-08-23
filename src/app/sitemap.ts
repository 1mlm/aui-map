import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://auimap.ma",
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
