"use client"

import { useEffect, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// iOS never fires beforeinstallprompt (no JS-triggerable install there, only the share sheet's
// manual "Add to Home Screen"). navigator.standalone is Safari's own "launched from the home
// screen" flag, matchMedia covers everything else
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type InstallPlatform =
  // Chrome / Edge / Samsung Internet: a real install prompt we can trigger
  | "prompt"
  // iPhone or iPad in Safari: only the manual share sheet steps work
  | "ios-safari"
  // iPhone or iPad in Chrome, Instagram's browser...: can't install at all, has to open Safari
  | "ios-other"
  // an Android browser that gave no install prompt (Samsung Internet, one already used up...):
  // the browser's own menu is the only way
  | "android-manual"
  | "none"

function detectIos() {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac, the touch points give it away
  const isIos =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (!isIos) return null
  const isSafari =
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/.test(ua)
  return isSafari ? "ios-safari" : "ios-other"
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true) // assume yes until checked, so nothing flashes
  const [ios, setIos] = useState<"ios-safari" | "ios-other" | null>(null)
  const [isAndroid, setIsAndroid] = useState(false)
  // true while the browser's own install box is on screen, the app dims everything and points at it
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIos(detectIos())
    setIsAndroid(/Android/.test(navigator.userAgent))

    function handleBeforeInstallPrompt(event: Event) {
      // stops chrome's own mini-infobar so the app's own button is the one and only trigger
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    function handleAppInstalled() {
      setDeferredPrompt(null)
      setInstalled(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      )
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
    } finally {
      setInstalling(false)
      // the same event never fires twice, spent either way
      setDeferredPrompt(null)
    }
  }

  const platform: InstallPlatform = installed
    ? "none"
    : deferredPrompt
      ? "prompt"
      : (ios ?? (isAndroid ? "android-manual" : "none"))

  return {
    canInstall: platform === "prompt",
    platform,
    installing,
    promptInstall,
  }
}
