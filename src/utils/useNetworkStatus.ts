"use client"

import { useEffect, useState } from "react"

// NetworkInformation isn't in TS's DOM lib yet — Chrome/Edge/Android only, no Firefox/Safari
type NetworkInformation = EventTarget & {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g"
  saveData?: boolean
}

function getConnection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection
}

export type NetworkStatus = {
  online: boolean
  // true once we actually know it's a slow link (2g/slow-2g) or the user's turned on data
  // saver — unsupported browsers just never report this, rather than guessing
  slowConnection: boolean
}

function isSlowConnection(connection: NetworkInformation | undefined) {
  if (!connection) return false
  return (
    connection.saveData === true ||
    connection.effectiveType === "2g" ||
    connection.effectiveType === "slow-2g"
  )
}

// navigator.onLine works everywhere; the connection quality half only where NetworkInformation
// is supported — both are exposed together since anything that cares about one usually cares
// about the other (a status banner, gating a network-dependent button, ...). Both start out
// "assume online, assume fast" and only settle to the real value inside an effect — Node's own
// `navigator` global (no `.onLine`/`.connection`) would otherwise make the server-rendered markup
// disagree with the client's first paint, the same hydration-mismatch trap useHashState avoids
export function useNetworkStatus(): NetworkStatus {
  const [online, setOnline] = useState(true)
  const [slowConnection, setSlowConnection] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    setSlowConnection(isSlowConnection(getConnection()))

    function handleOnline() {
      setOnline(true)
    }
    function handleOffline() {
      setOnline(false)
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    const connection = getConnection()
    if (!connection) return
    function handleChange() {
      setSlowConnection(isSlowConnection(connection))
    }
    connection.addEventListener("change", handleChange)
    return () => connection.removeEventListener("change", handleChange)
  }, [])

  return { online, slowConnection }
}
