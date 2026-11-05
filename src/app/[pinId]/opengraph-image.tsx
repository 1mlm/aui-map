import { ImageResponse } from "next/og"
import { placeNames } from "@/map/aliases"
import { getMapData } from "@/map/getMapData"
import { tagPinFillColor } from "@/map/tagColor"

export const alt = "A place on the Al Akhawayn University campus"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const revalidate = 3600

// satori only understands plain hex/rgb colours, the pin colours are oklch
function oklchToHex(value: string) {
  const [, l, c, h] =
    value.match(/oklch\(([\d.]+)%?\s+([\d.]+|none)\s+([\d.]+|none)/) ?? []
  if (!l) return "#2f7d4f"
  const L = Number(l) / 100
  const C = c === "none" ? 0 : Number(c)
  const H = ((h === "none" ? 0 : Number(h)) * Math.PI) / 180
  const a = C * Math.cos(H)
  const b = C * Math.sin(H)
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  const hex = lin.map((v) => {
    const clamped = Math.min(1, Math.max(0, v))
    const encoded =
      clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * clamped ** (1 / 2.4) - 0.055
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, "0")
  })
  return `#${hex.join("")}`
}

export default async function Image({
  params,
}: {
  params: Promise<{ pinId: string }>
}) {
  const { pinId } = await params
  const { items } = await getMapData()
  const pin = items.find((item) => item.id === pinId)
  const title = pin?.title ?? "AUI Map"
  const type = pin?.tag.label ?? "Campus map"
  const aliases = (pin ? placeNames(pin) : []).slice(0, 3).join("  ·  ")
  // satori needs a plain colour, the oklch pin colour is converted by its own parser
  const accent = pin ? oklchToHex(tagPinFillColor(pin.tag.color)) : "#2f7d4f"

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0f1f16 0%, #1b3a28 100%)",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            padding: "10px 26px",
            borderRadius: 24,
            background: accent,
            color: "white",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          {type}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontSize: title.length > 22 ? 84 : 112,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        {aliases && (
          <div style={{ fontSize: 38, color: "rgba(255,255,255,0.7)" }}>
            {aliases}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          fontSize: 34,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>Al Akhawayn University (AUI)</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 28 }}>
            Ifrane, Morocco
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 40 }}>auimap.ma</div>
      </div>
    </div>,
    size,
  )
}
