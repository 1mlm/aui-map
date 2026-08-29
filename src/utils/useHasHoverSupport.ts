"use client"

import { useEffect, useState } from "react"

// starts out assuming a real pointer (mouse/trackpad) is available, same "optimistic default,
// settle in an effect" pattern as useNetworkStatus — matchMedia isn't available during SSR, so
// guessing wrong here would otherwise disagree with the client's first paint
export function useHasHoverSupport() {
  const [hasHover, setHasHover] = useState(true)

  useEffect(() => {
    const query = window.matchMedia("(hover: hover)")
    setHasHover(query.matches)
    function handleChange(event: MediaQueryListEvent) {
      setHasHover(event.matches)
    }
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  return hasHover
}
