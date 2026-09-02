import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  // default 1mb is too small for a photo straight off a phone camera
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    remotePatterns: [
      { hostname: "github.com" },
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      {
        // the campus map background never changes at this path — a new image gets a new
        // filename instead — so it's safe to tell browsers to keep it indefinitely rather than
        // revalidating on every visit
        source: "/auimap-1312.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
