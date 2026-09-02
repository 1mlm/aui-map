import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, isAuthCookieValid } from "@/utils/auth"
import { createUploadSignature } from "@/utils/cloudinary"

// mints a signature so the browser can send pin photos straight to Cloudinary, bypassing the
// 4.5mb request body cap Vercel puts on every serverless function. can't reuse requireAuth()
// here — that calls next/navigation's redirect(), meant for pages/actions, not route handlers —
// so it checks the cookie directly and 401s instead
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies()
  if (!isAuthCookieValid(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  return NextResponse.json(createUploadSignature())
}
