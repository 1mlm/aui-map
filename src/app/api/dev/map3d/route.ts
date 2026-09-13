import { writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

// local authoring endpoint for the /3d map editor -- writes straight to the checked-in data files
// so an edit (currently just the terrain sculpt tool; footprint/building editing will add more
// targets here) lands as an ordinary source change you review and commit yourself. No auth, no
// DB, because there's nothing to protect: this 403s outright once NODE_ENV is "production", so it
// never exists as a live attack surface.
const SAVE_TARGETS = {
  terrainHeightmap: "src/map3d/terrainHeightmap.json",
} as const

type SaveTarget = keyof typeof SAVE_TARGETS

function isSaveTarget(value: unknown): value is SaveTarget {
  return typeof value === "string" && value in SAVE_TARGETS
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "The 3D map editor only saves in dev" },
      { status: 403 },
    )
  }

  const body = (await request.json()) as { target?: unknown; data?: unknown }
  if (!isSaveTarget(body.target))
    return NextResponse.json({ error: "Unknown save target" }, { status: 400 })

  // target is one of the fixed keys above, never a request-supplied path
  const filePath = path.join(process.cwd(), SAVE_TARGETS[body.target])
  await writeFile(filePath, `${JSON.stringify(body.data, null, 2)}\n`)
  return NextResponse.json({ ok: true })
}
