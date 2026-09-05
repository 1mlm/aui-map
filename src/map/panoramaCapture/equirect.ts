import type { Quaternion } from "three"
import { Vector3 } from "three"

// the one direction<->angle convention shared by the capture flow: reading the phone's current
// facing direction (quaternionToYawPitch) and the stitch shader (where on the panorama canvas
// does this ray land). stitch.ts's GLSL re-derives the yaw/pitch formula by hand (uniforms can't
// share a function with the CPU side) -- keep the two in sync if this ever changes
const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// no browser exposes a rear camera's real field of view, so this stands in for it -- most phone
// main lenses land somewhere around 60-70° horizontal. It's applied to whichever pixel dimension
// of the captured frame is longer, so it works whether getUserMedia hands back portrait or
// landscape buffers; the other dimension's FOV falls out of the frame's actual aspect ratio.
// tune this against a real phone if the panorama's seams look consistently too tight or too loose
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

function directionToYawPitch(direction: Vector3): {
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
