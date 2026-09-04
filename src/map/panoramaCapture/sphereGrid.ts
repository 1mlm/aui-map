// the fixed set of directions a capture walks the phone through to cover the full sphere. Rings
// get fewer targets the closer they are to the poles -- a ring near the zenith sweeps the same
// 360° in far less actual camera travel than the equator does, so packing it as densely would just
// mean redundant, overlapping shots up there
const PITCH_RINGS_DEG: { pitchDeg: number; yawCount: number }[] = [
  { pitchDeg: -60, yawCount: 8 },
  { pitchDeg: -30, yawCount: 10 },
  { pitchDeg: 0, yawCount: 12 },
  { pitchDeg: 30, yawCount: 10 },
  { pitchDeg: 60, yawCount: 8 },
]
// straight up and straight down -- one shot each rather than a ring, since every yaw converges to
// the same point there. Optional in practice: the confirm step accepts a sphere with these two
// still open, it just leaves a small gap at each pole
const POLE_PITCHES_DEG = [-90, 90]

export type CaptureTarget = {
  id: string
  yawDeg: number
  pitchDeg: number
}

export function buildCaptureTargets(): CaptureTarget[] {
  const ringTargets = PITCH_RINGS_DEG.flatMap(({ pitchDeg, yawCount }) =>
    Array.from({ length: yawCount }, (_, i) => ({
      id: `${pitchDeg}/${i}`,
      yawDeg: (360 / yawCount) * i,
      pitchDeg,
    })),
  )
  const poleTargets = POLE_PITCHES_DEG.map((pitchDeg) => ({
    id: `pole/${pitchDeg}`,
    yawDeg: 0,
    pitchDeg,
  }))
  return [...ringTargets, ...poleTargets]
}

// great-circle-ish angular distance between two yaw/pitch directions, in degrees. Not exact
// (treats pitch like latitude and yaw like longitude, which pinches near the poles), but that
// pinch only makes polar targets *easier* to satisfy, which is the right direction to be wrong in
export function angularDistanceDeg(
  a: { yawDeg: number; pitchDeg: number },
  b: { yawDeg: number; pitchDeg: number },
): number {
  const degToRad = Math.PI / 180
  const yawDiff = ((((a.yawDeg - b.yawDeg + 180) % 360) + 360) % 360) - 180
  const pitchDiff = a.pitchDeg - b.pitchDeg
  const pitchScale = Math.cos(((a.pitchDeg + b.pitchDeg) / 2) * degToRad)
  return Math.sqrt((yawDiff * pitchScale) ** 2 + pitchDiff ** 2)
}

// how close the reticle has to land on a target before it counts as covered -- generous relative
// to the grid's own spacing (~30-45°) so a capture doesn't need to be pixel-perfect, just roughly aimed
export const CAPTURE_TOLERANCE_DEG = 20

export function nearestUncoveredTarget(
  facing: { yawDeg: number; pitchDeg: number },
  targets: CaptureTarget[],
  coveredIds: ReadonlySet<string>,
): CaptureTarget | null {
  const uncovered = targets.filter((target) => !coveredIds.has(target.id))
  if (uncovered.length === 0) return null
  return uncovered.reduce((closest, target) =>
    angularDistanceDeg(facing, target) < angularDistanceDeg(facing, closest)
      ? target
      : closest,
  )
}

export function coveredTargetIds(
  facing: { yawDeg: number; pitchDeg: number },
  targets: CaptureTarget[],
): string[] {
  return targets
    .filter(
      (target) => angularDistanceDeg(facing, target) <= CAPTURE_TOLERANCE_DEG,
    )
    .map((target) => target.id)
}
