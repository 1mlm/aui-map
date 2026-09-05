"use client"

import { useEffect, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// iOS never fires beforeinstallprompt at all (no JS-triggerable install there, only the share
// sheet's manual "Add to Home Screen") -- matchMedia alone would still say "not installed" for an
// iOS PWA already added that way, since it has no beforeinstallprompt-driven install moment to
// detect either. navigator.standalone is Safari's own flag for exactly that case
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// android/desktop chrome+edge only, by design -- iOS has nothing this hook could trigger, so
// canInstall just stays false there for good and callers render nothing
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())

    function handleBeforeInstallPrompt(event: Event) {
      // stops chrome's own default mini-infobar so the app's own button is the one and only
      // prompt trigger
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
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    // the same event never fires twice -- spent either way, win or dismiss
    setDeferredPrompt(null)
  }

  return { canInstall: deferredPrompt !== null && !installed, promptInstall }
}
