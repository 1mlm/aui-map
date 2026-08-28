"use client"

import { useEffect, useState } from "react"

type SharedFeedbackDraft = {
  message: string
  attachment: { url: string; fileName: string; mimeType: string | null } | null
}

function readSharedDraft(): SharedFeedbackDraft | null {
  const params = new URLSearchParams(window.location.search)
  const message = params.get("sharedText") ?? ""
  const fileUrl = params.get("sharedFileUrl")
  if (!message && !fileUrl) return null
  return {
    message,
    attachment: fileUrl
      ? {
          url: fileUrl,
          fileName: params.get("sharedFileName") ?? "shared file",
          mimeType: params.get("sharedMimeType"),
        }
      : null,
  }
}

// a Web Share Target hand-off (src/app/share-target/route.ts) lands back on "/" carrying its
// result as query params rather than any real app state. Read only inside an effect (never as a
// useState initializer) so the server-rendered markup — which never sees these params — matches
// the client's first paint; this only settles in a render after that, same as useHashState.
// The URL is scrubbed in that same effect, immediately, so a refresh or a bookmark of the link
// never replays the same draft — but the returned `draft` value itself is left alone afterward
// (not reset to null) so it stays available for whichever render actually opens the feedback
// form and mounts SuggestionForm with it as a prefill
export function useSharedFeedbackDraft() {
  const [draft, setDraft] = useState<SharedFeedbackDraft | null>(null)

  useEffect(() => {
    const found = readSharedDraft()
    if (!found) return
    setDraft(found)
    const url = new URL(window.location.href)
    for (const key of [
      "sharedText",
      "sharedFileUrl",
      "sharedFileName",
      "sharedMimeType",
    ])
      url.searchParams.delete(key)
    window.history.replaceState(null, "", url)
  }, [])

  return draft
}
