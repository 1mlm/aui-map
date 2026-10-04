import { headers } from "next/headers"
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from "@/utils/loginLimits"
import { prisma } from "@/utils/prisma"

const WINDOW_MS = LOCKOUT_MINUTES * 60 * 1000

// vercel overwrites x-forwarded-for at its edge, so the first entry is the real client
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers()
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwardedFor || requestHeaders.get("x-real-ip") || "unknown"
}

function getWindowStart() {
  return new Date(Date.now() - WINDOW_MS)
}

export async function isRateLimited(ip: string): Promise<boolean> {
  const failedAttempts = await prisma.loginAttempt.count({
    where: { ip, createdAt: { gte: getWindowStart() } },
  })
  return failedAttempts >= MAX_FAILED_ATTEMPTS
}

export async function recordFailedAttempt(ip: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { ip } })
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: getWindowStart() } } })
}

export async function clearFailedAttempts(ip: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { ip } })
}
