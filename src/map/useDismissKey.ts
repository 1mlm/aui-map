"use client"

import { useEffect, useRef } from "react"

type CloseWatcherLike = { onclose: (() => void) | null; destroy: () => void }
type CloseWatcherConstructor = new () => CloseWatcherLike

// escape key everywhere, and CloseWatcher additionally catches android's back button/gesture —
// but shadcn's Radix dialogs (attachment viewer, contribute form) handle their own escape and
// aren't on this same watch, so a dialog open on top of us has to win the keypress first
function topmostDialogIsOpen() {
  return document.querySelector('[data-slot="dialog-content"]') !== null
}

export function useDismissKey(onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const CloseWatcherCtor = (
      window as unknown as { CloseWatcher?: CloseWatcherConstructor }
    ).CloseWatcher

    if (CloseWatcherCtor) {
      const watcher = new CloseWatcherCtor()
      watcher.onclose = () => {
        if (!topmostDialogIsOpen()) onDismissRef.current()
      }
      return () => watcher.destroy()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !topmostDialogIsOpen())
        onDismissRef.current()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}
