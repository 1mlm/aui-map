"use server"

import { prisma } from "@/utils/prisma"

// public — the bulb icon on the map posts here, no auth required. Returns an error string
// instead of throwing (a thrown Error's message gets redacted by Next in production) —
// the caller already guards against an empty message, this is just defense in depth.
// the file (if any) is already sitting in Blob storage by the time this runs — SuggestionForm
// uploads it client-side first (via src/app/api/contribute/upload) to stay under the 4.5mb
// body limit a server action would otherwise hit
export async function submitSuggestion(
  message: string,
  blob: { url: string; fileName: string; mimeType: string | null } | null,
): Promise<{ error: string } | undefined> {
  const trimmed = message.trim()
  if (!trimmed) return { error: "Message required" }
  await prisma.suggestion.create({
    data: {
      message: trimmed,
      fileUrl: blob?.url,
      fileName: blob?.fileName,
      mimeType: blob?.mimeType,
    },
  })
}
