import { Euler, Quaternion, Vector3 } from "three"

// three.js's own DeviceOrientationControls example does this exact conversion (alpha/beta/gamma
// -> quaternion, then two fixed rotations: one because a phone's screen-relative axes don't line
// up with camera axes, one for whatever way the device is currently held vs its "natural"
// orientation) -- reimplemented here instead of importing three/examples so nothing pulls in an
// examples-subpath build target, and so the screen-angle correction below can reuse the same axis
const CAMERA_FACES_BACK_OF_DEVICE = new Quaternion(
  -Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2,
)
const ZEE_AXIS = new Vector3(0, 0, 1)

// alpha/beta/gamma (degrees, per the DeviceOrientationEvent spec) -> a quaternion for a camera
// that looks out the back of the phone, corrected for the current screen rotation (so turning the
// phone from portrait to landscape mid-capture doesn't skew every reading after it)
export function deviceOrientationToQuaternion(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
): Quaternion {
  const degToRad = Math.PI / 180
  const euler = new Euler(
    betaDeg * degToRad,
    alphaDeg * degToRad,
    -gammaDeg * degToRad,
    "YXZ",
  )
  const quaternion = new Quaternion().setFromEuler(euler)
  quaternion.multiply(CAMERA_FACES_BACK_OF_DEVICE)
  quaternion.multiply(
    new Quaternion().setFromAxisAngle(ZEE_AXIS, -screenAngleDeg * degToRad),
  )
  return quaternion
}

function currentScreenAngleDeg(): number {
  // screen.orientation is the standards path; window.orientation is the old iOS Safari fallback
  // (still the only one some older WebViews expose)
  if (typeof screen !== "undefined" && screen.orientation)
    return screen.orientation.angle
  const legacyOrientation = (window as { orientation?: number }).orientation
  return legacyOrientation ?? 0
}

// iOS Safari only exposes orientation data after a permission prompt, and that prompt only works
// when requested synchronously inside a user gesture -- so this has to be called directly from an
// onClick, never after an earlier `await`. Android and desktop have no such permission and this
// resolves true immediately
export async function requestOrientationPermission(): Promise<boolean> {
  const RequestPermissionEvent = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">
  }
  if (typeof RequestPermissionEvent.requestPermission !== "function")
    return true
  try {
    const result = await RequestPermissionEvent.requestPermission()
    return result === "granted"
  } catch {
    return false
  }
}

export type OrientationSample = {
  quaternion: Quaternion
  alphaDeg: number
  betaDeg: number
  gammaDeg: number
  // how fast the phone was turning at this instant -- used to catch a capture taken mid-swing
  // before it can turn into a blurry tile on the sphere (see PanoramaCapture's motion-blur check)
  angularVelocityDegPerSec: number
}

const RAD2DEG = 180 / Math.PI

// live feed of the phone's current facing direction, as a quaternion -- the capture UI reads
// `.current` on every animation frame rather than subscribing, since it only ever needs the latest
// sample and re-rendering React on every gyro tick (they fire much faster than the screen) would
// be pure waste
export class OrientationTracker {
  current: OrientationSample | null = null
  private previousQuaternion: Quaternion | null = null
  private previousTimestampMs = 0
  private listener = (event: DeviceOrientationEvent) => {
    if (event.alpha === null || event.beta === null || event.gamma === null)
      return
    const quaternion = deviceOrientationToQuaternion(
      event.alpha,
      event.beta,
      event.gamma,
      currentScreenAngleDeg(),
    )

    const now = performance.now()
    const elapsedMs = now - this.previousTimestampMs
    const angularVelocityDegPerSec =
      this.previousQuaternion && elapsedMs > 0
        ? (this.previousQuaternion.angleTo(quaternion) * RAD2DEG) /
          (elapsedMs / 1000)
        : 0
    this.previousQuaternion = quaternion.clone()
    this.previousTimestampMs = now

    this.current = {
      quaternion,
      alphaDeg: event.alpha,
      betaDeg: event.beta,
      gammaDeg: event.gamma,
      angularVelocityDegPerSec,
    }
  }

  start() {
    window.addEventListener("deviceorientation", this.listener)
  }

  stop() {
    window.removeEventListener("deviceorientation", this.listener)
  }
}
