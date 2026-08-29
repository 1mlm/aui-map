import fs from "node:fs"
import path from "node:path"

export const size = { width: 836, height: 837 }
export const contentType = "image/jpeg"

// a real screenshot of the map with pins on it, not the bare satellite tile — reads better as a
// link preview. Served as raw bytes rather than through an ImageResponse/satori pipeline, which
// choked on embedding a full-size image (see git history on this file for that crash). JPEG, not
// the original PNG export — the lossless PNG was 1.7mb, heavy enough that some link-unfurling
// crawlers (WhatsApp in particular) just gave up on it. Re-encoded at quality 85 (~200kb), no
// visible difference at preview size
export default function OpengraphImage() {
  const imageBuffer = fs.readFileSync(
    path.join(process.cwd(), "src/app/og-source.jpg"),
  )
  return new Response(new Uint8Array(imageBuffer), {
    headers: { "Content-Type": contentType },
  })
}
