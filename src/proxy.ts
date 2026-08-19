import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, isAuthCookieValid } from "@/utils/auth"

export const config = {
  matcher: ["/admin/:path*"],
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.redirect(url)
}

export default function proxy(request: NextRequest) {
  const isAuthenticated = isAuthCookieValid(request.cookies.get(AUTH_COOKIE_NAME)?.value)
  const isLoginRoute = request.nextUrl.pathname === "/admin/login"

  if (!isAuthenticated && !isLoginRoute) return redirectTo(request, "/admin/login")
  if (isAuthenticated && isLoginRoute) return redirectTo(request, "/admin")
  return NextResponse.next()
}
