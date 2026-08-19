"use server"

import { prisma } from "@/utils/prisma"

// public — the bulb icon on the map posts here, no auth required
export async function submitSuggestion(message: string) {
  const trimmed = message.trim()
  if (!trimmed) throw new Error("Message required")
  await prisma.suggestion.create({ data: { message: trimmed } })
}
