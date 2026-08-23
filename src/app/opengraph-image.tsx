import fs from "node:fs"
import path from "node:path"

export const size = { width: 836, height: 837 }
export const contentType = "image/png"

// a real screenshot of the map with pins on it, not the bare satellite tile — reads better as a
// link preview. Served as raw bytes rather than through an ImageResponse/satori pipeline, which
// choked on embedding a full-size image (see git history on this file for that crash)
export default function OpengraphImage() {
  const imageBuffer = fs.readFileSync(
    path.join(process.cwd(), "src/app/og-source.png"),
  )
  return new Response(new Uint8Array(imageBuffer), {
    headers: { "Content-Type": contentType },
  })
}
