import type { Quaternion } from "three"
import { Vector3 } from "three"

// the one direction<->angle convention shared by every piece of the capture flow: the sphere grid
// (which target am I closest to), the reticle (which way should I turn), and the stitch shader
// (where in the equirectangular canvas does this ray land). stitch.ts's GLSL re-derives the same
// formula by hand (uniforms can't share a function with the CPU side) -- keep the two in sync if
// this ever changes
const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// no browser exposes a rear camera's real field of view, so this stands in for it -- most phone
// main lenses land somewhere around 60-70° horizontal. It's applied to whichever pixel dimension
// of the captured frame is longer, so it works whether getUserMedia hands back portrait or
// landscape buffers; the other dimension's FOV falls out of the frame's actual aspect ratio.
// tune this against a real phone if seams look consistently too tight or too loose. Shared with
// the live capture reticle (PanoramaCapture.tsx) so the on-screen guide agrees with what the
// stitcher actually samples -- two separate guesses at the same physical quantity would mean the
// reticle points somewhere the accumulated photo doesn't actually cover
export const CAMERA_LONG_EDGE_FOV_DEG = 66

export function tanHalfFov(widthPx: number, heightPx: number) {
  const longPx = Math.max(widthPx, heightPx)
  const shortPx = Math.min(widthPx, heightPx)
  const halfLongFov = (CAMERA_LONG_EDGE_FOV_DEG / 2) * DEG2RAD
  const halfShortFov = Math.atan(Math.tan(halfLongFov) * (shortPx / longPx))
  const tanLong = Math.tan(halfLongFov)
  const tanShort = Math.tan(halfShortFov)
  return widthPx >= heightPx
    ? { tanHalfFovX: tanLong, tanHalfFovY: tanShort }
    : { tanHalfFovX: tanShort, tanHalfFovY: tanLong }
}

// shortest signed difference from `b` to `a`, in degrees, wrapped to -180..180 -- e.g. going from
// 350° to 10° is a +20° step, not -340°. Yaw wraps around the compass, so a plain subtraction
// picks the long way round about half the time
export function wrapDeltaDeg(deltaDeg: number): number {
  return ((((deltaDeg + 180) % 360) + 360) % 360) - 180
}

export function yawPitchToDirection(yawDeg: number, pitchDeg: number): Vector3 {
  const yaw = yawDeg * DEG2RAD
  const pitch = pitchDeg * DEG2RAD
  return new Vector3(
    Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  )
}

export function directionToYawPitch(direction: Vector3): {
  yawDeg: number
  pitchDeg: number
} {
  return {
    yawDeg: Math.atan2(direction.z, direction.x) * RAD2DEG,
    pitchDeg: Math.asin(Math.max(-1, Math.min(1, direction.y))) * RAD2DEG,
  }
}

// a camera's local forward under three.js convention is -Z -- this is "which way is the phone's
// back-facing lens pointed", expressed in the same shared yaw/pitch labels as everything else
export function quaternionToYawPitch(quaternion: Quaternion): {
  yawDeg: number
  pitchDeg: number
} {
  const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion)
  return directionToYawPitch(forward)
}

// where a world-space direction actually lands in the current camera's view, in the same
// normalized device coordinates the accumulate shader projects into (before dividing by
// tanHalfFov) -- null once the direction is more than 90° off-axis, since a perspective camera
// can't represent that as a screen point at all. Used to place the live capture reticle exactly
// where an uncovered target really is in the video frame, instead of an arbitrary clamped offset
export function worldDirectionToLocalNdc(
  worldDirection: Vector3,
  quaternion: Quaternion,
): { x: number; y: number } | null {
  const local = worldDirection
    .clone()
    .applyQuaternion(quaternion.clone().invert())
  if (local.z >= 0) return null
  return { x: local.x / -local.z, y: local.y / -local.z }
}
