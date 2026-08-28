"use client"

import { useCallback, useEffect, useState } from "react"

function readHash() {
  return window.location.hash.slice(1) || null
}

// mirrors nuqs's useQueryState shape, but against location.hash (/#m6l) instead of a search
// param — a hash never reaches the server, so unlike the old ?focus= param this can't be read
// during SSR and only settles in once this effect runs after the initial client render
export function useHashState(): [
  string | null,
  (value: string | null) => void,
] {
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    setValue(readHash())
    function handleHashChange() {
      setValue(readHash())
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const setHash = useCallback((next: string | null) => {
    setValue(next)
    const url = new URL(window.location.href)
    url.hash = next ?? ""
    window.history.replaceState(null, "", url)
  }, [])

  return [value, setHash]
}
