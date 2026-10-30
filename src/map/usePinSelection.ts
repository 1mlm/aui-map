"use client"

import { useEffect, useState } from "react"

// the selected pin lives in the url path (/b8) so every place is a real, indexable page. Updated
// with replaceState instead of router.push: opening a pin shouldn't re-run the server page or add
// a history entry, the map is already loaded with every pin
export function usePinSelection(
  initialId: string | null,
): [string | null, (value: string | null) => void] {
  const [selectedId, setSelectedId] = useState(initialId)

  useEffect(() => {
    // printed QRCodes and old shared links are /#b8, move them onto the real /b8 url
    const legacyId = window.location.hash.slice(1)
    if (!legacyId) return
    setSelectedId(legacyId)
    window.history.replaceState(null, "", `/${legacyId}`)
  }, [])

  function selectPin(next: string | null) {
    setSelectedId(next)
    window.history.replaceState(null, "", next ? `/${next}` : "/")
  }

  return [selectedId, selectPin]
}
