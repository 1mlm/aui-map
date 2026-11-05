import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, isAuthCookieValid } from "@/utils/auth"
import { prisma } from "@/utils/prisma"

// a recorded walk can be tens of thousands of points, more than a server action accepts, so it is
// sent here instead. Same cookie check as the photo upload, 401 instead of a redirect
export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies()
  if (!isAuthCookieValid(cookieStore.get(AUTH_COOKIE_NAME)?.value))
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    startedAt?: unknown
    points?: unknown
    marks?: unknown
  } | null
  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.startedAt !== "number" ||
    !Array.isArray(body.points) ||
    body.points.length === 0 ||
    body.points.length > 100_000
  )
    return NextResponse.json({ error: "Invalid walk" }, { status: 400 })

  const track = await prisma.walkTrack.create({
    data: {
      name: body.name.slice(0, 120) || "Walk",
      startedAt: new Date(body.startedAt),
      points: body.points,
      marks: Array.isArray(body.marks) ? body.marks : [],
    },
    select: { id: true },
  })
  return NextResponse.json({ id: track.id })
}
