import { type HapticInput, WebHaptics } from "web-haptics"

// android gets navigator.vibrate, ios gets the hidden <input type=checkbox switch> trick — one
// instance owns that hidden node for the whole app. Client components are still evaluated on the
// server, where there's no DOM for it to attach to.
const haptics = typeof window === "undefined" ? null : new WebHaptics()

export const triggerHaptic = (input: HapticInput = "selection") => haptics?.trigger(input)
