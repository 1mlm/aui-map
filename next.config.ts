import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactCompiler: true,
  // lets cloudflared/ngrok tunnel domains, and a phone on the same LAN via next dev's own
  // printed "Network:" address, request dev-only assets -- otherwise Next silently blocks them
  // and the page loads unhydrated (looks static, no clicks/drag/zoom work)
  allowedDevOrigins: ["*.trycloudflare.com", "10.126.107.65"],
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
    // dev-only (including tunnel testing) skips the immutable cache: a bad transfer over a
    // flaky connection -- one truncated/corrupted response -- would otherwise get locked into
    // the browser's cache forever, since `immutable` means it's never even revalidated on a
    // normal reload. In production the file at this path genuinely never changes (a new image
    // gets a new filename instead), so caching it indefinitely is safe there
    if (process.env.NODE_ENV !== "production") return []
    return [
      {
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
