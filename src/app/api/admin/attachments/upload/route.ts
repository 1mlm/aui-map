import { type HandleUploadBody, handleUpload } from "@vercel/blob/client"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, isAuthCookieValid } from "@/utils/auth"
import { extractErrorMessage } from "@/utils/error"

// mints a client-upload token so the browser can send pin photos straight to Blob storage,
// bypassing the 4.5mb request body cap Vercel puts on every serverless function. can't reuse
// requireAuth() here — that calls next/navigation's redirect(), meant for pages/actions, not
// route handlers — so it checks the cookie directly and throws, which handleUpload turns into
// a 400 response
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const cookieStore = await cookies()
        if (!isAuthCookieValid(cookieStore.get(AUTH_COOKIE_NAME)?.value)) {
          throw new Error("Not authenticated")
        }
        return { addRandomSuffix: true }
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: extractErrorMessage(error, "Upload failed.") },
      { status: 400 },
    )
  }
}
