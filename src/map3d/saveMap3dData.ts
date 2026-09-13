// posts an edit-mode change to the dev-only save route (src/app/api/dev/map3d/route.ts), which
// writes it straight to the matching checked-in JSON file. Only ever succeeds in development --
// see that route for why there's no auth here.
export type Map3dSaveTarget = "terrainHeightmap"

export async function saveMap3dData(
  target: Map3dSaveTarget,
  data: unknown,
): Promise<void> {
  const response = await fetch("/api/dev/map3d", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, data }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? "Save failed")
  }
}
