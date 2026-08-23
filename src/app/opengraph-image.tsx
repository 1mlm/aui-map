import fs from "node:fs"
import path from "node:path"

export const size = { width: 1200, height: 1200 }
export const contentType = "image/jpeg"

// pre-downscaled via Next's own image optimizer (fetched from /_next/image) rather than the
// original 3542x3542 public/auimap.webp — embedding that full-size webp in an ImageResponse
// crashed the dev server (satori/resvg choking on it), so this serves a small pre-shrunk jpeg
// directly instead
export default function OpengraphImage() {
  const imageBuffer = fs.readFileSync(path.join(process.cwd(), "src/app/og-source.jpg"))
  return new Response(new Uint8Array(imageBuffer), {
    headers: { "Content-Type": contentType },
  })
}
