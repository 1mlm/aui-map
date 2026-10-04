"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AUTH_COOKIE_NAME, getExpectedAuthCookieValue, isCodeCorrect } from "@/utils/auth"
import {
  clearFailedAttempts,
  getClientIp,
  isRateLimited,
  recordFailedAttempt,
} from "@/utils/loginRateLimit"

export async function unlockWithCode(
  _prevState: { error: boolean },
  formData: FormData,
): Promise<{ error: boolean; rateLimited?: boolean }> {
  const ip = await getClientIp()
  // checked before the code itself, so a correct guess during a lockout is refused too
  const isLockedOut = await isRateLimited(ip)
  if (isLockedOut) return { error: true, rateLimited: true }

  const code = String(formData.get("code") ?? "")
  if (!isCodeCorrect(code)) {
    await recordFailedAttempt(ip)
    return { error: true }
  }
  await clearFailedAttempts(ip)

  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, getExpectedAuthCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  })

  redirect("/admin")
}
