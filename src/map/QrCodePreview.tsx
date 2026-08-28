"use client"

import { useEffect, useRef } from "react"
import { qrCodeOptions } from "./qrCodeOptions"

const PREVIEW_SIZE = 280

// qr-code-styling is DOM-imperative (appends a canvas into a container) and touches `window`,
// so it's loaded dynamically here rather than imported at module scope — this file only ever
// runs client-side anyway ("use client"), but a top-level import would still break the build
export function QrCodePreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !container) return
      const qrCode = new QRCodeStyling(qrCodeOptions(url, PREVIEW_SIZE))
      qrCode.append(container)
    })

    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [url])

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl corner-squircle"
      style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
    />
  )
}
