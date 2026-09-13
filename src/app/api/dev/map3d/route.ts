import { execFile } from "node:child_process"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

const execFileAsync = promisify(execFile)

// local authoring endpoint for the /3d map editor -- writes straight to the checked-in data files
// so an edit lands as an ordinary source change you review and commit yourself. No auth, no DB,
// because there's nothing to protect: this 403s outright once NODE_ENV is "production", so it
// never exists as a live attack surface. Never deletes a Pin row either way -- see
// buildingFootprints.ts's `hidden` flag for why a pin-linked building can only ever be hidden.
const SAVE_TARGETS = {
  buildingFootprints: "src/map3d/buildingFootprints.json",
  extraBuildings: "src/map3d/extraBuildings.json",
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
  const relativePath = SAVE_TARGETS[body.target]
  const filePath = path.join(process.cwd(), relativePath)
  // plain compact JSON first (matches how these files are originally generated, e.g.
  // scripts/trace-building-footprints.ts), then biome formats it into the project's normal
  // JSON style -- doing our own pretty-printing here would reformat every untouched entry too,
  // turning a one-building edit into a multi-thousand-line diff
  await writeFile(filePath, JSON.stringify(body.data))
  await execFileAsync("npx", ["biome", "format", "--write", relativePath], {
    cwd: process.cwd(),
    shell: true,
  })
  return NextResponse.json({ ok: true })
}
