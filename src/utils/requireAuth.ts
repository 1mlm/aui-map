import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AUTH_COOKIE_NAME, isAuthCookieValid } from "@/utils/auth"

// proxy.ts covers page navigation, but server actions can be invoked directly —
// every mutating admin action calls this first
export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies()
  if (!isAuthCookieValid(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    redirect("/admin/login")
  }
}
