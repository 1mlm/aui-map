import type { Metadata } from "next"
import { prisma } from "@/utils/prisma"
import { PanoramaPlacer } from "./PanoramaPlacer"

export const metadata: Metadata = { title: "Panoramas" }

export default async function AdminPanoramasPage() {
  const panoramas = await prisma.panorama.findMany({
    select: {
      uuid: true,
      url: true,
      thumbnailUrl: true,
      caption: true,
      spherical: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return <PanoramaPlacer {...{ panoramas }} />
}
