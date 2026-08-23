"use server"

import { prisma } from "@/utils/prisma"

// public — the bulb icon on the map posts here, no auth required. Returns an error string
// instead of throwing (a thrown Error's message gets redacted by Next in production) —
// the caller already guards against an empty message, this is just defense in depth
export async function submitSuggestion(
  message: string,
): Promise<{ error: string } | undefined> {
  const trimmed = message.trim()
  if (!trimmed) return { error: "Message required" }
  await prisma.suggestion.create({ data: { message: trimmed } })
}
