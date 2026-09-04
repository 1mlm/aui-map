"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { cn } from "@/shadcn/utils"
import { triggerConfetti } from "@/utils/confetti"
import { triggerHaptic } from "@/utils/haptics"
import {
  quaternionToYawPitch,
  tanHalfFov,
  worldDirectionToLocalNdc,
  wrapDeltaDeg,
  yawPitchToDirection,
} from "./equirect"
import { OrientationTracker, requestOrientationPermission } from "./orientation"
import { SphereViewer } from "./SphereViewer"
import {
  angularDistanceDeg,
  buildCaptureTargets,
  coveredTargetIds,
  nearestUncoveredTarget,
} from "./sphereGrid"
import { PanoramaStitcher } from "./stitch"

// torch is real and widely supported (Android Chrome) but not part of the DOM lib's official
// MediaTrack types -- iOS Safari never implemented it at all, which is exactly what
// getCapabilities().torch existing-or-not below is used to detect, rather than assuming
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean }

// how close the reticle has to sit on a target before a shot fires on its own -- tighter than
// CAPTURE_TOLERANCE_DEG (which decides what a shot *counts as covering* after the fact), so
// lining up on a target reliably takes one auto-capture, not three
const AUTO_CAPTURE_TOLERANCE_DEG = 10
// once lined up, how long to hold still before the shot actually fires -- long enough to let the
// phone settle after the turn that got it there, short enough not to feel like a wait
const AUTO_CAPTURE_DWELL_MS = 3000
const NO_SENSOR_TIMEOUT_MS = 3000
const SHUTTER_FLASH_MS = 150
// how fast the phone can be turning at the instant a shot fires before it counts as unusably
// blurry -- guessed, tune against a real phone: raise it if clean-looking shots keep getting
// rejected, lower it if visibly blurry ones keep sneaking through
const MOTION_BLUR_MAX_DEG_PER_SEC = 60

const TARGETS = buildCaptureTargets()
// the two poles are optional (see sphereGrid.ts) -- "ready to finish" is judged against the ring
// targets alone, so a capture that never looked straight up or down doesn't get stuck at 96%
const RING_TARGETS = TARGETS.filter((target) => !target.id.startsWith("pole/"))
// below this, Done stays a soft "finish anyway" rather than a confident "you're set" -- high
// enough that finishing early actually means a visibly gappy sphere, not just a formality
const READY_RING_COVERAGE_RATIO = 0.8

function countCoveredRingTargets(coveredIds: ReadonlySet<string>) {
  return RING_TARGETS.filter((target) => coveredIds.has(target.id)).length
}

type Step =
  | { kind: "start" }
  | { kind: "requesting" }
  | { kind: "error"; message: string }
  | { kind: "capturing" }
  | { kind: "confirming" }

function captureStillFrame(
  video: HTMLVideoElement,
  scratch: HTMLCanvasElement,
) {
  scratch.width = video.videoWidth
  scratch.height = video.videoHeight
  const ctx = scratch.getContext("2d")
  if (!ctx) return
  ctx.drawImage(video, 0, 0)
}

export function PanoramaCapture({
  onCaptured,
  onCancel,
}: {
  onCaptured: (file: File) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<Step>({ kind: "start" })
  // the covered-target ids themselves live in a ref (coveredIdsRef below) since capture is a
  // per-frame hot path -- this number exists only to force a re-render when it changes, the
  // actual count is always read fresh off the ref
  const [, forceCoverageUpdate] = useState(0)
  const [noSensor, setNoSensor] = useState(false)
  // whether this device/browser's camera track exposes a torch at all (iOS Safari never does) --
  // the toggle only ever renders once this is confirmed true, rather than showing a button that'd
  // just fail silently
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const reticleRef = useRef<HTMLDivElement>(null)
  const dwellRingRef = useRef<HTMLDivElement>(null)
  const guideDotRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)
  const statusTextRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<OrientationTracker | null>(null)
  const stitcherRef = useRef<PanoramaStitcher | null>(null)
  const coveredIdsRef = useRef<Set<string>>(new Set())
  // targets that got a shot but it came out too blurry to keep (see MOTION_BLUR_MAX_DEG_PER_SEC)
  // -- deliberately kept out of coveredIdsRef so the guide naturally sends the phone back there,
  // this just remembers to show that spot as "needs a retake" red rather than "never visited" white
  const flaggedIdsRef = useRef<Set<string>>(new Set())
  // when the reticle first lined up on the current target, so the dwell ring knows how far through
  // its hold it is -- null whenever not currently lined up on anything
  const lineUpStartedAtRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  // bumped on every handleStart -- keys the confirm step's SphereViewer so a retry gets a fresh
  // WebGL context instead of reusing one pointed at a stitcher that's already been disposed
  const sessionIdRef = useRef(0)
  // edge-detectors so a haptic/confetti fires once when a state first becomes true, not on every
  // animation frame it stays true
  const wasLinedUpRef = useRef(false)
  const wasReadyRef = useRef(false)

  function stopSensors() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    trackerRef.current?.stop()
    trackerRef.current = null
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }

  // this is a plain fixed overlay, not a Dialog, so nothing else locks the page underneath it --
  // without this a drag on the reticle can scroll the map behind the black screen
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: stopSensors only touches refs, identity doesn't matter -- this is the unmount-only cleanup
  useEffect(() => {
    return () => {
      stopSensors()
      stitcherRef.current?.dispose()
      stitcherRef.current = null
    }
  }, [])

  // the <video> only mounts once `step` becomes "capturing", so handleStart (which runs earlier,
  // while the stream is still being requested) can't hand the stream to a ref that doesn't exist
  // yet -- this attaches it once the element is actually there
  useEffect(() => {
    if (step.kind !== "capturing") return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
  }, [step])

  function flashShutter(color: "white" | "red" = "white") {
    const flash = flashRef.current
    if (!flash) return
    flash.style.backgroundColor = color === "red" ? "#f87171" : "#ffffff"
    flash.style.opacity = "1"
    setTimeout(() => {
      flash.style.opacity = "0"
    }, SHUTTER_FLASH_MS)
  }

  function doCapture() {
    const video = videoRef.current
    const scratch = scratchCanvasRef.current
    const stitcher = stitcherRef.current
    const facing = trackerRef.current?.current
    if (!video || !scratch || !stitcher || !facing) return

    const facingYawPitch = quaternionToYawPitch(facing.quaternion)
    const affectedTargetIds = coveredTargetIds(facingYawPitch, TARGETS)

    // the phone was still turning too fast right as this fired -- it would just add a blurry
    // smear to the sphere, so it's rejected outright rather than accumulated. The affected spots
    // stay (or become) flagged red instead of covered, so the guide sends the phone straight back
    if (facing.angularVelocityDegPerSec > MOTION_BLUR_MAX_DEG_PER_SEC) {
      for (const id of affectedTargetIds) flaggedIdsRef.current.add(id)
      flashShutter("red")
      triggerHaptic("error")
      lineUpStartedAtRef.current = null
      forceCoverageUpdate((n) => n + 1)
      return
    }

    captureStillFrame(video, scratch)
    stitcher.accumulate(scratch, facing.quaternion)
    flashShutter()
    // a sharp, single-click feel -- reads as a shutter, not a generic tap
    triggerHaptic("rigid")

    for (const id of affectedTargetIds) {
      coveredIdsRef.current.add(id)
      flaggedIdsRef.current.delete(id)
    }
    lineUpStartedAtRef.current = null
    forceCoverageUpdate((n) => n + 1)

    const isReady =
      countCoveredRingTargets(coveredIdsRef.current) >=
      Math.ceil(RING_TARGETS.length * READY_RING_COVERAGE_RATIO)
    if (isReady && !wasReadyRef.current) {
      wasReadyRef.current = true
      // haptic only, no confetti here -- the camera's still fullscreen and mid-rotation, and
      // confetti painting over the viewfinder would obscure whatever's left to aim at. The visual
      // celebration is saved for handleConfirm, once the screen's actually static
      triggerHaptic("success")
    }
  }

  function runGuideLoop() {
    const facing = trackerRef.current?.current
    const video = videoRef.current
    if (facing && video) {
      // the no-sensor timeout (below, in handleStart) only ever checks once, 3s in -- if
      // orientation data was just a little slow to start (a common real-device hiccup right after
      // the permission prompt), that one check latches noSensor true forever, even once readings
      // are clearly flowing. This is the only place that can see "actually, it's working now" and
      // undo it -- otherwise the manual shutter stays wrongly disabled for the rest of the session
      if (noSensor) setNoSensor(false)

      const facingYawPitch = quaternionToYawPitch(facing.quaternion)
      const nearest = nearestUncoveredTarget(
        facingYawPitch,
        TARGETS,
        coveredIdsRef.current,
      )

      if (nearest) {
        const distanceToNearestDeg = angularDistanceDeg(facingYawPitch, nearest)
        const linedUp = distanceToNearestDeg < AUTO_CAPTURE_TOLERANCE_DEG
        const isRetake = flaggedIdsRef.current.has(nearest.id)
        const activeColor = isRetake ? "#f87171" : "#4ade80"

        // same field of view the stitcher actually samples with (see equirect.ts) -- so the dot
        // lands exactly where the target really is in the video frame, not an approximation
        const { tanHalfFovX, tanHalfFovY } = tanHalfFov(
          video.videoWidth || 1,
          video.videoHeight || 1,
        )
        const targetDirection = yawPitchToDirection(
          nearest.yawDeg,
          nearest.pitchDeg,
        )
        const ndc = worldDirectionToLocalNdc(targetDirection, facing.quaternion)
        const onScreen =
          ndc !== null &&
          Math.abs(ndc.x) <= tanHalfFovX &&
          Math.abs(ndc.y) <= tanHalfFovY

        if (onScreen && guideDotRef.current) {
          const leftPercent = 50 + 50 * (ndc.x / tanHalfFovX)
          const topPercent = 50 - 50 * (ndc.y / tanHalfFovY)
          guideDotRef.current.style.left = `${leftPercent}%`
          guideDotRef.current.style.top = `${topPercent}%`
          guideDotRef.current.style.opacity = "1"
          guideDotRef.current.style.backgroundColor = linedUp
            ? activeColor
            : isRetake
              ? "#fca5a5"
              : "#ffffff"
          guideDotRef.current.style.transform = `translate(-50%, -50%) scale(${linedUp ? 1.3 : 1})`
        } else if (guideDotRef.current) {
          guideDotRef.current.style.opacity = "0"
        }

        // the target's fallen out of the camera's frame entirely -- a dot clamped to a fixed
        // radius would just sit pinned at the edge here, no matter how much further off it
        // actually is, and stop giving any useful feedback. A big arrow that keeps pointing the
        // real direction (however far) reads as responsive the whole way there instead
        if (arrowRef.current) {
          if (onScreen) {
            arrowRef.current.style.opacity = "0"
          } else {
            const yawDiff = wrapDeltaDeg(nearest.yawDeg - facingYawPitch.yawDeg)
            const pitchDiff = nearest.pitchDeg - facingYawPitch.pitchDeg
            const angleDeg = Math.atan2(yawDiff, pitchDiff) * (180 / Math.PI)
            arrowRef.current.style.transform = `rotate(${angleDeg}deg)`
            arrowRef.current.style.opacity = "1"
            arrowRef.current.style.color = isRetake ? "#f87171" : "#ffffff"
          }
        }

        if (reticleRef.current)
          reticleRef.current.style.borderColor = linedUp
            ? activeColor
            : isRetake
              ? "rgba(248,113,113,0.8)"
              : "rgba(255,255,255,0.7)"

        // holding lined-up long enough is what actually fires the shot (see below) -- this ring
        // sweeps clockwise around the crosshair over that same hold so the wait has something to
        // watch instead of just... waiting, unsure if it's even registering the alignment
        const dwellElapsedMs = linedUp
          ? performance.now() -
            (lineUpStartedAtRef.current ?? performance.now())
          : 0
        const dwellPercent = Math.min(
          100,
          (dwellElapsedMs / AUTO_CAPTURE_DWELL_MS) * 100,
        )
        if (dwellRingRef.current) {
          dwellRingRef.current.style.opacity = linedUp ? "1" : "0"
          dwellRingRef.current.style.background = `conic-gradient(${activeColor} ${dwellPercent}%, rgba(255,255,255,0.25) ${dwellPercent}%)`
        }

        if (statusTextRef.current)
          statusTextRef.current.textContent = linedUp
            ? "Hold still…"
            : isRetake
              ? "Retake, that one was blurry"
              : onScreen
                ? "Center the dot"
                : "Turn toward the arrow"

        if (linedUp) {
          // a light tick right as the reticle locks on, so aiming feels responsive even in the
          // brief window before the dwell timer starts counting down
          if (!wasLinedUpRef.current) triggerHaptic("light")
          lineUpStartedAtRef.current ??= performance.now()
          if (dwellElapsedMs >= AUTO_CAPTURE_DWELL_MS) doCapture()
        } else {
          lineUpStartedAtRef.current = null
        }
        wasLinedUpRef.current = linedUp
      } else {
        if (guideDotRef.current) guideDotRef.current.style.opacity = "0"
        if (arrowRef.current) arrowRef.current.style.opacity = "0"
        if (dwellRingRef.current) dwellRingRef.current.style.opacity = "0"
        if (reticleRef.current) reticleRef.current.style.borderColor = "#4ade80"
        if (statusTextRef.current)
          statusTextRef.current.textContent = "Full coverage, nice"
        lineUpStartedAtRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(runGuideLoop)
  }

  async function handleStart() {
    triggerHaptic()
    setStep({ kind: "requesting" })
    // must come before any other await in this handler -- iOS only honors the motion-permission
    // prompt when it's still inside the click's own gesture context
    const orientationGranted = await requestOrientationPermission()
    if (!orientationGranted) {
      triggerHaptic("error")
      setStep({
        kind: "error",
        message:
          "Motion access is needed to line up the sphere. Enable it for this site in Settings and try again.",
      })
      return
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        // 1920 was overkill: a 66°-wide capture only ever lands on a ~560px-wide slice of the
        // 3072px-wide equirect canvas, so anything past that is decoded and drawn every frame for
        // nothing -- 1280 is still comfortably oversampled and noticeably lighter on the phone
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      })
    } catch {
      triggerHaptic("error")
      setStep({
        kind: "error",
        message:
          "Couldn't reach the camera. Check the site has camera access and try again.",
      })
      return
    }

    const capabilities = streamRef.current
      .getVideoTracks()[0]
      ?.getCapabilities?.() as TorchCapabilities | undefined
    setTorchSupported(Boolean(capabilities?.torch))
    setTorchOn(false)

    stitcherRef.current?.dispose()
    stitcherRef.current = new PanoramaStitcher()
    sessionIdRef.current += 1
    if (previewContainerRef.current) {
      previewContainerRef.current.replaceChildren(stitcherRef.current.canvas)
      stitcherRef.current.canvas.className =
        "size-full rounded-xl corner-squircle object-cover"
    }
    coveredIdsRef.current = new Set()
    flaggedIdsRef.current = new Set()
    forceCoverageUpdate(0)
    lineUpStartedAtRef.current = null
    wasLinedUpRef.current = false
    wasReadyRef.current = false

    const tracker = new OrientationTracker()
    tracker.start()
    trackerRef.current = tracker
    setNoSensor(false)
    setTimeout(() => {
      // guards against a stale timer outliving a retry/cancel that already swapped in (or tore
      // down) a different tracker
      if (trackerRef.current === tracker && !tracker.current) {
        triggerHaptic("warning")
        setNoSensor(true)
      }
    }, NO_SENSOR_TIMEOUT_MS)

    setStep({ kind: "capturing" })
    rafRef.current = requestAnimationFrame(runGuideLoop)
  }

  function handleFinishCapturing() {
    triggerHaptic("medium")
    stopSensors()
    // the live thumbnail's been rendering cheap and small this whole time (see stitch.ts) -- bring
    // it back up to full resolution now, once, since this same canvas is what the confirm step's
    // SphereViewer actually displays
    stitcherRef.current?.renderFullPreview()
    setStep({ kind: "confirming" })
  }

  function handleRetry() {
    triggerHaptic()
    stitcherRef.current?.dispose()
    stitcherRef.current = null
    setStep({ kind: "start" })
  }

  async function handleConfirm() {
    const stitcher = stitcherRef.current
    if (!stitcher) return
    triggerHaptic("success")
    triggerConfetti()
    const blob = await stitcher.exportBlob()
    const file = new File([blob], "panorama.png", { type: "image/png" })
    stitcher.dispose()
    stitcherRef.current = null
    onCaptured(file)
  }

  function handleCancel() {
    triggerHaptic()
    stopSensors()
    stitcherRef.current?.dispose()
    stitcherRef.current = null
    onCancel()
  }

  // stopping the track later (stopSensors, on cancel/retry/finish) releases the camera hardware
  // outright, which turns the torch off with it -- nothing to clean up here beyond that
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const nextTorchOn = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchOn } as TorchConstraintSet],
      })
      setTorchOn(nextTorchOn)
      triggerHaptic()
    } catch {
      triggerHaptic("error")
    }
  }

  // the ring is what actually gates "done" (poles are optional, see RING_TARGETS above) -- shown
  // to the user as the one coverage number so what they see matches what unlocks the button
  const coveredRingCount = countCoveredRingTargets(coveredIdsRef.current)
  const coveragePercent = Math.round(
    (coveredRingCount / RING_TARGETS.length) * 100,
  )
  const isReadyToFinish =
    coveredRingCount >=
    Math.ceil(RING_TARGETS.length * READY_RING_COVERAGE_RATIO)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {(step.kind === "start" ||
        step.kind === "requesting" ||
        step.kind === "error") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-white">
          <Icon icon={ICONS.contributePanorama} className="size-10" />
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium">
              Capture a spherical panorama
            </p>
            <p className="max-w-xs text-sm text-white/70">
              {step.kind === "error"
                ? step.message
                : "Turn slowly to fill every direction: up, down, and all the way around. A dot marks the next spot to aim at, or an arrow points the way once it's out of frame."}
            </p>
          </div>
          <Button
            className="rounded-full corner-squircle"
            disabled={step.kind === "requesting"}
            onClick={handleStart}
          >
            <Icon icon={ICONS.shutter} />
            {step.kind === "requesting"
              ? "Starting…"
              : step.kind === "error"
                ? "Try again"
                : "Start"}
          </Button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-white/60 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {step.kind === "capturing" && (
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 size-full object-cover"
          />
          <canvas ref={scratchCanvasRef} className="hidden" />

          {/* a brief white flash on every shutter fire, the same visual beat any camera app
              gives a capture -- opacity is toggled directly (not React state) so it can hit every
              frame the auto-capture loop wants without fighting re-renders */}
          <div
            ref={flashRef}
            className="pointer-events-none absolute inset-0 bg-white opacity-0 transition-opacity duration-150"
          />

          {/* sweeps clockwise over the 3s hold once lined up, so the wait before a shot actually
              fires has something to watch -- a ring rather than a bar since it wraps the crosshair
              it's timing. The "hole" in the middle is a mask, not a second element */}
          <div
            ref={dwellRingRef}
            style={{
              maskImage:
                "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
              WebkitMaskImage:
                "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
            }}
            className="pointer-events-none absolute top-1/2 left-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-opacity"
          />

          {/* fixed crosshair, always exactly where the camera is currently pointed -- recolors
              green (or red, mid-retake) the instant the roaming target dot lines up with it */}
          <div
            ref={reticleRef}
            style={{ borderColor: "rgba(255,255,255,0.7)" }}
            className="pointer-events-none absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors"
          />

          {/* the next uncovered spot on the sphere, projected onto the video frame with the same
              field of view the stitcher samples with -- sits exactly where that direction really
              is in frame, not an approximation clamped to a fixed radius */}
          <div
            ref={guideDotRef}
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            className="pointer-events-none absolute size-5 rounded-full opacity-0 shadow-[0_0_10px_rgba(0,0,0,0.7)] transition-opacity"
          />

          {/* takes over once the next target is out of frame entirely -- a dot clamped at a fixed
              radius would just sit pinned at the edge no matter how far off the real target still
              is, and stop feeling responsive. This keeps pointing the real direction the whole way */}
          <div
            ref={arrowRef}
            className="pointer-events-none absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity"
          >
            <Icon
              icon={ICONS.turnArrow}
              className="size-14 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
            />
          </div>

          <div
            ref={statusTextRef}
            className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-full corner-squircle bg-black/60 px-4 py-1.5 text-center text-sm font-medium text-white backdrop-blur-sm"
          >
            Point your camera around
          </div>

          {noSensor && (
            <div className="absolute top-4 right-4 left-4 rounded-xl corner-squircle bg-black/70 p-3 text-center text-xs text-white backdrop-blur-sm">
              No motion sensor found. This needs a phone to aim the shots.
            </div>
          )}

          <div className="absolute top-4 left-4 size-28 overflow-hidden rounded-xl corner-squircle border border-white/30 shadow-lg">
            <div ref={previewContainerRef} className="size-full" />
          </div>

          <IconButton
            icon={ICONS.close}
            tone="overlay"
            onClick={handleCancel}
            className="absolute top-4 right-4"
            aria-label="Cancel"
          />

          {/* only ever rendered once the track itself confirmed a torch exists -- iOS Safari
              never exposes one at all, and a button that just silently fails is worse than none */}
          {torchSupported && (
            <IconButton
              icon={torchOn ? ICONS.flashlightOn : ICONS.flashlightOff}
              tone={torchOn ? "primary" : "overlay"}
              onClick={toggleTorch}
              className="absolute top-20 right-4"
              aria-label={
                torchOn ? "Turn off flashlight" : "Turn on flashlight"
              }
            />
          )}

          <div className="absolute right-0 bottom-0 left-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-6">
            <div className="flex w-full max-w-64 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full corner-squircle bg-white/20">
                <div
                  className={cn(
                    "h-full rounded-full corner-squircle transition-[width,background-color]",
                    isReadyToFinish ? "bg-green-400" : "bg-white/80",
                  )}
                  style={{ width: `${Math.min(100, coveragePercent)}%` }}
                />
              </div>
              <span className="w-9 text-right text-xs tabular-nums text-white/70">
                {coveragePercent}%
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={doCapture}
                disabled={noSensor}
                aria-label="Capture"
                className={cn(
                  "flex size-16 items-center justify-center rounded-full corner-squircle border-4 border-white bg-white/20",
                  noSensor && "opacity-40",
                )}
              >
                <Icon icon={ICONS.shutter} className="size-6 text-white" />
              </button>
              <IconButton
                icon={ICONS.success}
                tone={isReadyToFinish ? "primary" : "subtle"}
                shape="corner-superellipse/1.2"
                aria-label={isReadyToFinish ? "Done" : "Finish anyway"}
                className={cn(
                  "size-14",
                  coveredRingCount === 0 && "opacity-50",
                )}
                iconClassName="text-xl"
                disabled={coveredRingCount === 0}
                onClick={handleFinishCapturing}
              />
            </div>
          </div>
        </div>
      )}

      {step.kind === "confirming" && stitcherRef.current && (
        <div className="relative flex-1">
          <SphereViewer
            key={sessionIdRef.current}
            image={{ kind: "canvas", canvas: stitcherRef.current.canvas }}
          />
          <div className="pointer-events-none absolute top-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
            <div className="rounded-full corner-squircle bg-black/60 px-4 py-2 text-center text-sm text-white backdrop-blur-sm">
              Drag to look around
            </div>
            <div
              className={cn(
                "rounded-full corner-squircle px-3 py-1 text-xs font-medium backdrop-blur-sm",
                isReadyToFinish
                  ? "bg-green-400/20 text-green-300"
                  : "bg-amber-400/20 text-amber-300",
              )}
            >
              {isReadyToFinish
                ? "Full coverage"
                : `${coveragePercent}% covered, some spots have gaps`}
            </div>
          </div>
          <div className="absolute right-0 bottom-0 left-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-6">
            <IconButton
              icon={ICONS.reopen}
              tone="overlay"
              shape="corner-superellipse/1.2"
              className="size-14"
              iconClassName="text-xl"
              aria-label="Retry"
              onClick={handleRetry}
            />
            <IconButton
              icon={ICONS.success}
              tone="primary"
              shape="corner-superellipse/1.2"
              className="size-16"
              iconClassName="text-2xl"
              aria-label="Use this"
              onClick={handleConfirm}
            />
            <IconButton
              icon={ICONS.close}
              tone="overlay"
              shape="corner-superellipse/1.2"
              className="size-14"
              iconClassName="text-xl"
              aria-label="Cancel"
              onClick={handleCancel}
            />
          </div>
        </div>
      )}
    </div>
  )
}
