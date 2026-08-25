"use client"

import { useState } from "react"
import { copyToClipboard } from "./clipboard"

const DEFAULT_FEEDBACK_MS = 1500

// copies text to the clipboard and flips `copied` on for a bit, the "Copied!"/checkmark
// flash used anywhere a copy button lives
export function useCopyFeedback(feedbackMs = DEFAULT_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false)

  async function copy(text: string) {
    const succeeded = await copyToClipboard(text)
    if (!succeeded) return false
    setCopied(true)
    setTimeout(() => setCopied(false), feedbackMs)
    return true
  }

  return { copied, copy }
}
