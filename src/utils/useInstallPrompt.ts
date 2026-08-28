"use client"

import { useEffect, useState } from "react"

// not in TS's DOM lib
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<unknown[]>
}

// exposes a custom "Install app" affordance instead of relying on the browser's own generic
// install icon/banner — canInstall only ever turns true after the browser decides this page is
// installable AND getInstalledRelatedApps (where supported) confirms it isn't already
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [alreadyInstalled, setAlreadyInstalled] = useState(false)

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      )
  }, [])

  useEffect(() => {
    const nav = navigator as NavigatorWithRelatedApps
    nav.getInstalledRelatedApps?.().then((apps) => {
      if (apps.length > 0) setAlreadyInstalled(true)
    })
  }, [])

  async function promptInstall() {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    // the prompt can only ever be used once — accepted or not, it's spent
    setDeferredEvent(null)
    return outcome
  }

  return {
    canInstall: deferredEvent !== null && !alreadyInstalled,
    promptInstall,
  }
}
