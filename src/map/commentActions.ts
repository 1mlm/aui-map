"use server"

import { prisma } from "@/utils/prisma"

const MIN_LENGTH = 4
const MAX_LENGTH = 600
const MAX_PER_VISITOR_PER_HOUR = 5
const MAX_PER_HOUR_OVERALL = 60

export type CommentResult = { error: string } | { ok: true }

// anyone can send one, an admin reads it in /admin/comments before anything changes on the map.
// Expected failures come back as { error } (Next hides a thrown message in production)
export async function submitPinComment(input: {
  pinId: string
  message: string
  visitorId?: string
  // honeypot: a real person never sees this field, so anything in it is a bot
  website?: string
}): Promise<CommentResult> {
  if (input.website) return { ok: true }

  const message = String(input.message ?? "")
    .replace(/\s+\n/g, "\n")
    .trim()
  if (message.length < MIN_LENGTH) return { error: "Write a bit more." }
  if (message.length > MAX_LENGTH)
    return { error: `Keep it under ${MAX_LENGTH} characters.` }

  const visitorId = input.visitorId?.slice(0, 64) || null
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const [overall, mine, pin] = await Promise.all([
    prisma.submission.count({ where: { submittedAt: { gte: hourAgo } } }),
    visitorId
      ? prisma.submission.count({
          where: { visitorId, submittedAt: { gte: hourAgo } },
        })
      : Promise.resolve(0),
    prisma.pin.findUnique({
      where: { id: String(input.pinId) },
      select: { uuid: true },
    }),
  ])
  if (!pin) return { error: "That place no longer exists." }
  if (mine >= MAX_PER_VISITOR_PER_HOUR || overall >= MAX_PER_HOUR_OVERALL)
    return { error: "Too many comments right now, try again in a while." }

  await prisma.submission.create({
    data: { kind: "PIN_EDIT", pinId: pin.uuid, message, visitorId },
  })
  return { ok: true }
}
