"use client"

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react"
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  WebGLRenderer,
} from "three"

// same feel as PanoramaLayer's flat scroller (native touch drag, hand-rolled fling for mouse/pen),
// just driving a camera's yaw/pitch instead of a scrollLeft
const FLING_FRICTION_PER_FRAME = 0.94
const FLING_STOP_VELOCITY_DEG_MS = 0.005
// how many screen-pixels of drag correspond to one degree of look -- tuned by feel, not tied to fov
const DRAG_DEG_PER_PX = 0.15
const MAX_PITCH_DEG = 85
const CAMERA_FOV_DEG = 75

export type SphereImageSource =
  | { kind: "url"; url: string }
  | { kind: "canvas"; canvas: HTMLCanvasElement }

// a full 360 sphere, viewable by drag (mouse/pen) or native touch panning. Renders the image as
// an equirectangular scene background rather than a textured sphere mesh -- three's background
// shader already samples equirect textures with exactly the yaw/pitch convention equirect.ts
// uses, so there's no UV convention to keep in sync by hand
export function SphereViewer({ image }: { image: SphereImageSource }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const yawDeg = useRef(0)
  const pitchDeg = useRef(0)
  const dragOrigin = useRef<{
    pointerX: number
    pointerY: number
    yawDeg: number
    pitchDeg: number
  } | null>(null)
  const velocitySamples = useRef<
    { time: number; yawDeg: number; pitchDeg: number }[]
  >([])
  const flingFrame = useRef<number | null>(null)

  // `image` is fixed for the lifetime of one viewer instance -- a new panorama gets a fresh
  // component via `key`, the same way MapExperience keys other one-shot views -- so the WebGL
  // context this effect owns is only ever set up once per mount, never torn down mid-look
  // biome-ignore lint/correctness/useExhaustiveDependencies: image is intentionally read only at mount, see above
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 10)

    const texture: Texture =
      image.kind === "canvas"
        ? new CanvasTexture(image.canvas)
        : new TextureLoader().load(image.url)
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    scene.background = texture

    function resize() {
      if (!container) return
      const { clientWidth, clientHeight } = container
      if (clientWidth === 0 || clientHeight === 0) return
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const degToRad = Math.PI / 180
    let animationFrame = requestAnimationFrame(function loop() {
      camera.rotation.set(
        pitchDeg.current * degToRad,
        yawDeg.current * degToRad,
        0,
        "YXZ",
      )
      renderer.render(scene, camera)
      animationFrame = requestAnimationFrame(loop)
    })

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      renderer.dispose()
      texture.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  function stopFling() {
    if (flingFrame.current !== null) {
      cancelAnimationFrame(flingFrame.current)
      flingFrame.current = null
    }
  }

  function applyLook(nextYawDeg: number, nextPitchDeg: number) {
    yawDeg.current = nextYawDeg
    pitchDeg.current = Math.max(
      -MAX_PITCH_DEG,
      Math.min(MAX_PITCH_DEG, nextPitchDeg),
    )
  }

  function runFling(yawVelocityDegMs: number, pitchVelocityDegMs: number) {
    if (
      Math.abs(yawVelocityDegMs) < FLING_STOP_VELOCITY_DEG_MS &&
      Math.abs(pitchVelocityDegMs) < FLING_STOP_VELOCITY_DEG_MS
    ) {
      flingFrame.current = null
      return
    }
    applyLook(
      yawDeg.current + yawVelocityDegMs * 16,
      pitchDeg.current + pitchVelocityDegMs * 16,
    )
    flingFrame.current = requestAnimationFrame(() =>
      runFling(
        yawVelocityDegMs * FLING_FRICTION_PER_FRAME,
        pitchVelocityDegMs * FLING_FRICTION_PER_FRAME,
      ),
    )
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    stopFling()
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      yawDeg: yawDeg.current,
      pitchDeg: pitchDeg.current,
    }
    velocitySamples.current = [
      {
        time: event.timeStamp,
        yawDeg: yawDeg.current,
        pitchDeg: pitchDeg.current,
      },
    ]
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = dragOrigin.current
    if (!origin) return
    // dragging right should reveal what's further right, same as dragging a photo itself right --
    // content needs to move with the finger, which for this camera's rotation.y means yaw grows
    // (not shrinks) as the drag moves right. Verified against the actual reported inversion, not
    // just derived on paper -- three.js's camera.rotation.set with "YXZ" order doesn't map onto
    // screen-left/right as intuitively as it looks
    applyLook(
      origin.yawDeg + (event.clientX - origin.pointerX) * DRAG_DEG_PER_PX,
      origin.pitchDeg + (event.clientY - origin.pointerY) * DRAG_DEG_PER_PX,
    )
    velocitySamples.current.push({
      time: event.timeStamp,
      yawDeg: yawDeg.current,
      pitchDeg: pitchDeg.current,
    })
    const cutoff = event.timeStamp - 50
    while (
      velocitySamples.current.length > 1 &&
      velocitySamples.current[0].time < cutoff
    )
      velocitySamples.current.shift()
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragOrigin.current = null
    try {
      ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {}

    const samples = velocitySamples.current
    const first = samples[0]
    const last = samples.at(-1)
    if (first && last && last.time > first.time) {
      const dt = last.time - first.time
      runFling(
        (last.yawDeg - first.yawDeg) / dt,
        (last.pitchDeg - first.pitchDeg) / dt,
      )
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: stopFling only touches the ref, identity doesn't matter
  useEffect(() => stopFling, [])

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="size-full touch-none [&>canvas]:size-full"
    />
  )
}
