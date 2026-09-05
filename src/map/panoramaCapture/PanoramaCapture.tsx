"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { cn } from "@/shadcn/utils"
import { triggerConfetti } from "@/utils/confetti"
import { triggerHaptic } from "@/utils/haptics"
import { useDragScroll } from "@/utils/useDragScroll"
import { quaternionToYawPitch, wrapDeltaDeg } from "./equirect"
import { OrientationTracker, requestOrientationPermission } from "./orientation"
import { PanoramaStitcher } from "./stitch"

// torch is real and widely supported (Android Chrome) but not part of the DOM lib's official
// MediaTrack types -- iOS Safari never implemented it at all, which is exactly what
// getCapabilities().torch existing-or-not below is used to detect, rather than assuming
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean }

// how much the frame captured for one photo overlaps the previous one -- the camera's own FOV is
// ~66° wide, so an 8° step keeps roughly 58° of overlap between neighbors, generous room for the
// stitcher's local alignment search to actually find a matching seam
const SAMPLE_STEP_DEG = 8
// captured frames get downscaled to this before stitching -- full camera resolution buys nothing
// once frames overlap this much (they're already oversampled relative to the final panorama) and
// costs real GPU/CPU time on every one of the ~30-45 frames a full sweep captures
const WORKING_LONG_EDGE_PX = 960
// how fast the phone can be turning when a sample is due before it's skipped for that tick --
// tried again next frame once (hopefully) slower, rather than adding a blurry frame
const MOTION_BLUR_MAX_DEG_PER_SEC = 90
// keep the phone roughly level -- past this the captured band drifts noticeably off the horizon
const LEVEL_TOLERANCE_DEG = 18
const NO_SENSOR_TIMEOUT_MS = 3000
// a sweep this close to a full 360° loop finishes itself -- doesn't have to be exactly 360 since
// the loop's start and end frames already overlap generously by the time it gets here
const AUTO_FINISH_SWEPT_DEG = 350
// finishing early (the manual Finish button) still needs *something* worth stitching
const MIN_FINISH_SWEPT_DEG = 40

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
  const longEdge = Math.max(video.videoWidth, video.videoHeight)
  const scale = Math.min(1, WORKING_LONG_EDGE_PX / longEdge)
  scratch.width = Math.round(video.videoWidth * scale)
  scratch.height = Math.round(video.videoHeight * scale)
  const ctx = scratch.getContext("2d")
  if (!ctx) return
  ctx.drawImage(video, 0, 0, scratch.width, scratch.height)
}

// the confirm step's own preview -- a plain horizontally-scrollable, drag-and-flingable strip
// showing the stitched canvas at full resolution, the same viewer PanoramaLayer uses for a saved
// flat panorama (see useDragScroll). No 360 library, nothing to load: it's already just a wide
// image by the time capture finishes
function FlatPreview({ canvas }: { canvas: HTMLCanvasElement }) {
  const { ref: scrollRef, dragging, handlers } = useDragScroll<HTMLDivElement>()
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    canvas.className = "block h-full w-auto max-w-none"
    host.replaceChildren(canvas)
  }, [canvas])

  return (
    <div
      ref={scrollRef}
      {...handlers}
      className={cn(
        "absolute inset-0 flex touch-pan-x items-center overflow-x-auto overflow-y-hidden select-none",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <div ref={hostRef} className="h-full shrink-0" />
    </div>
  )
}

export function PanoramaCapture({
  onCaptured,
  onCancel,
}: {
  onCaptured: (file: File) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<Step>({ kind: "start" })
  // the stitcher's own sweptDeg is a live number read off a ref-held instance, not React state --
  // this exists purely to force a re-render when it (and the frame count) changes, the actual
  // values are always read fresh
  const [, forceCoverageUpdate] = useState(0)
  const [noSensor, setNoSensor] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewStripRef = useRef<HTMLDivElement>(null)
  const levelLineRef = useRef<HTMLDivElement>(null)
  const statusTextRef = useRef<HTMLDivElement>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)
  const progressTextRef = useRef<HTMLDivElement>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<OrientationTracker | null>(null)
  const stitcherRef = useRef<PanoramaStitcher | null>(null)
  const frameCountRef = useRef(0)
  // the yaw the last sample was taken at -- null means no sample yet, the very next reading
  // always samples regardless of how far it's turned to get there
  const lastSampledYawDegRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  // bumped on every handleStart -- keys the confirm step's preview so a retry gets a fresh
  // WebGL context instead of reusing one pointed at a stitcher that's already been disposed
  const sessionIdRef = useRef(0)

  function stopSensors() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    trackerRef.current?.stop()
    trackerRef.current = null
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }

  // this is a plain fixed overlay, not a Dialog, so nothing else locks the page underneath it --
  // without this a drag on the preview can scroll the map behind the black screen
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

  // the <video> only mounts once `step` becomes "capturing" (which handleStart, running earlier
  // while the stream is still being requested, can't reach yet) -- this attaches it once the
  // element is actually there
  useEffect(() => {
    if (step.kind !== "capturing") return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
  }, [step])

  function runCaptureLoop() {
    const facing = trackerRef.current?.current
    const video = videoRef.current
    const stitcher = stitcherRef.current
    const scratch = scratchCanvasRef.current

    if (facing && video && stitcher && scratch) {
      // see doCapture's sibling comment in the old discrete-target flow -- the no-sensor timeout
      // only ever checks once, 3s in, and this is the only place that can see readings are
      // actually flowing now and undo it
      if (noSensor) setNoSensor(false)

      const { yawDeg, pitchDeg } = quaternionToYawPitch(facing.quaternion)
      const isLevel = Math.abs(pitchDeg) <= LEVEL_TOLERANCE_DEG
      const isTurningTooFast =
        facing.angularVelocityDegPerSec > MOTION_BLUR_MAX_DEG_PER_SEC

      if (levelLineRef.current) {
        const tiltPx = Math.max(-40, Math.min(40, pitchDeg * 2))
        levelLineRef.current.style.transform = `translateY(${tiltPx}px)`
        levelLineRef.current.style.backgroundColor = isLevel
          ? "#4ade80"
          : "#ffffff"
      }
      if (statusTextRef.current)
        statusTextRef.current.textContent = isTurningTooFast
          ? "Slow down a little"
          : !isLevel
            ? "Keep the phone level"
            : "Slowly turn all the way around"

      const dueForSample =
        lastSampledYawDegRef.current === null ||
        Math.abs(wrapDeltaDeg(yawDeg - lastSampledYawDegRef.current)) >=
          SAMPLE_STEP_DEG

      if (dueForSample && !isTurningTooFast) {
        lastSampledYawDegRef.current = yawDeg
        captureStillFrame(video, scratch)
        stitcher.addFrame(scratch, facing.quaternion, yawDeg)
        frameCountRef.current += 1
        triggerHaptic("light")
        forceCoverageUpdate((n) => n + 1)
      }

      const sweptPercent = Math.min(100, (stitcher.sweptDeg / 360) * 100)
      if (progressFillRef.current)
        progressFillRef.current.style.width = `${sweptPercent}%`
      if (progressTextRef.current)
        progressTextRef.current.textContent = `${Math.round(sweptPercent)}%`

      if (stitcher.sweptDeg >= AUTO_FINISH_SWEPT_DEG) {
        handleFinishCapturing()
        return
      }
    }
    rafRef.current = requestAnimationFrame(runCaptureLoop)
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
          "Motion access is needed to follow along as you turn. Enable it for this site in Settings and try again.",
      })
      return
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: WORKING_LONG_EDGE_PX },
        },
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
    stitcherRef.current = null
    sessionIdRef.current += 1
    frameCountRef.current = 0
    lastSampledYawDegRef.current = null
    forceCoverageUpdate(0)

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
  }

  // the stitcher needs the video's real frame size to know its own pixel density -- can't be
  // constructed until the <video> element has actually decoded a frame and reports it, which is
  // why this waits for `capturing` rather than happening in handleStart alongside everything else
  // biome-ignore lint/correctness/useExhaustiveDependencies: runCaptureLoop only reads refs, identity doesn't matter
  useEffect(() => {
    if (step.kind !== "capturing") return
    const video = videoRef.current
    if (!video) return

    function startOnceReady() {
      if (!video || video.videoWidth === 0) return
      stitcherRef.current = new PanoramaStitcher(
        video.videoWidth,
        video.videoHeight,
      )
      if (previewStripRef.current) {
        previewStripRef.current.replaceChildren(stitcherRef.current.canvas)
        stitcherRef.current.canvas.className = "h-full w-full object-cover"
      }
      rafRef.current = requestAnimationFrame(runCaptureLoop)
    }

    if (video.videoWidth > 0) startOnceReady()
    else {
      video.addEventListener("loadedmetadata", startOnceReady, { once: true })
      return () => video.removeEventListener("loadedmetadata", startOnceReady)
    }
  }, [step])

  function handleFinishCapturing() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    triggerHaptic("medium")
    stopSensors()
    // the live strip's been rendering cheap and small this whole time -- bring it back up to
    // full resolution now, once, since this same canvas is what the confirm step's preview shows
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

  const sweptDeg = stitcherRef.current?.sweptDeg ?? 0
  const canFinishEarly = sweptDeg >= MIN_FINISH_SWEPT_DEG

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {(step.kind === "start" ||
        step.kind === "requesting" ||
        step.kind === "error") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-white">
          <Icon icon={ICONS.contributePanorama} className="size-10" />
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium">Capture a panorama</p>
            <p className="max-w-xs text-sm text-white/70">
              {step.kind === "error"
                ? step.message
                : "Hold the phone level and slowly turn all the way around. It stitches itself as you go -- no need to stop and aim at anything."}
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

          {/* a level line, not a reticle -- there's no single point to aim at any more, just
              "keep the phone roughly horizontal while you turn". Tracks pitch directly, turns
              green once level */}
          <div
            ref={levelLineRef}
            className="pointer-events-none absolute top-1/2 right-8 left-8 h-0.5 bg-white opacity-80 shadow-[0_0_6px_rgba(0,0,0,0.6)] transition-colors"
          />

          <div
            ref={statusTextRef}
            className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-full corner-squircle bg-black/60 px-4 py-1.5 text-center text-sm font-medium text-white backdrop-blur-sm"
          >
            Slowly turn all the way around
          </div>

          {noSensor && (
            <div className="absolute top-4 right-4 left-4 rounded-xl corner-squircle bg-black/70 p-3 text-center text-xs text-white backdrop-blur-sm">
              No motion sensor found. This needs a phone to follow the turn.
            </div>
          )}

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

          {/* the live stitched result so far, as a real (if narrow) strip of the actual
              panorama -- not a mysterious square thumbnail off to the side. It's what's actually
              happening, shown as it happens */}
          <div className="absolute right-0 bottom-20 left-0 flex flex-col items-center gap-2 px-4">
            <div className="h-16 w-full max-w-md overflow-hidden rounded-xl corner-squircle border border-white/30 shadow-lg">
              <div ref={previewStripRef} className="size-full bg-black/40" />
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full corner-squircle bg-white/20">
                <div
                  ref={progressFillRef}
                  className="h-full rounded-full corner-squircle bg-green-400 transition-[width]"
                  style={{ width: "0%" }}
                />
              </div>
              <div
                ref={progressTextRef}
                className="w-9 text-right text-xs tabular-nums text-white/70"
              >
                0%
              </div>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 left-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-6">
            <IconButton
              icon={ICONS.success}
              tone={canFinishEarly ? "primary" : "subtle"}
              shape="corner-superellipse/1.2"
              aria-label="Finish now"
              className={cn("size-14", !canFinishEarly && "opacity-50")}
              iconClassName="text-xl"
              disabled={!canFinishEarly}
              onClick={handleFinishCapturing}
            />
          </div>
        </div>
      )}

      {step.kind === "confirming" && stitcherRef.current && (
        <div className="relative flex-1 bg-neutral-900">
          <FlatPreview
            key={sessionIdRef.current}
            canvas={stitcherRef.current.canvas}
          />
          <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2">
            <div className="rounded-full corner-squircle bg-black/60 px-4 py-2 text-center text-sm text-white backdrop-blur-sm">
              Drag to look around
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
