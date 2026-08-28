import type { Options as QrCodeOptions } from "qr-code-styling"
import { COMPASS_MARK_SVG } from "./compassMarkSvg"

const QR_DARK_GREEN = "#1A5632"
const QR_LIGHT_GREEN = "#3FA868"

const CENTER_MARK_DATA_URL = `data:image/svg+xml,${encodeURIComponent(COMPASS_MARK_SVG)}`

// shared between the live preview and the PNG generated for copy/share/download, so what someone
// sees before saving is exactly what they end up with
export function qrCodeOptions(url: string, size: number): QrCodeOptions {
  return {
    width: size,
    height: size,
    type: "canvas",
    data: url,
    margin: 8,
    qrOptions: { errorCorrectionLevel: "H" },
    image: CENTER_MARK_DATA_URL,
    imageOptions: { imageSize: 0.22, margin: 6, crossOrigin: "anonymous" },
    dotsOptions: {
      type: "extra-rounded",
      gradient: {
        type: "linear",
        rotation: Math.PI / 4,
        colorStops: [
          { offset: 0, color: QR_DARK_GREEN },
          { offset: 1, color: QR_LIGHT_GREEN },
        ],
      },
    },
    cornersSquareOptions: { type: "extra-rounded", color: QR_DARK_GREEN },
    cornersDotOptions: { type: "dot", color: QR_DARK_GREEN },
    backgroundOptions: { color: "#ffffff" },
  }
}
