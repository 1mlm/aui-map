"use client"

import {
  type MotionValue,
  motion,
  useMotionValueEvent,
  useTransform,
} from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import { Dialog, DialogContent, DialogTitle } from "@/shadcn/ui/dialog"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { useDragScroll } from "@/utils/useDragScroll"
import { latLongToPosition, positionToStyle } from "./geo"
import { SphereViewer } from "./panoramaCapture/SphereViewer"
import type { MapPanorama } from "./types"

// panoramas are scenery, not destinations, so they stay out of the way until someone has zoomed
// into a specific corner of campus. A hard cutoff would pop them in mid-pinch and read as a
// rendering bug, so they fade across this range instead
const PANORAMA_FADE_START_SCALE = 1.9
const PANORAMA_FADE_END_SCALE = 2.4
const MARKER_SIZE_PX = 34

// how much taller than the viewer the image renders once zoomed in, in percent of its own
// unzoomed height -- width grows with it (the image scales by its own aspect ratio), so this is
// really "how much more of the photo can you pan across once zoomed"
const ZOOMED_HEIGHT_PERCENT = 170

export function PanoramaLayer({
  panoramas,
  viewportScale,
}: {
  panoramas: MapPanorama[]
  viewportScale: MotionValue<number>
}) {
  const [openUuid, setOpenUuid] = useState<string | null>(null)
  const opacity = useTransform(
    viewportScale,
    [PANORAMA_FADE_START_SCALE, PANORAMA_FADE_END_SCALE],
    [0, 1],
  )
  // markers counter the map's zoom so they stay a constant size on screen, the same way pins do
  const counterScale = useTransform(viewportScale, (scale) => 1 / scale)
  const open = panoramas.find((panorama) => panorama.uuid === openUuid) ?? null

  // thumbnails stay unmounted (not just invisible) until zoom has actually crossed into the
  // fade-in range -- an <Image> fetches the moment it mounts regardless of its own opacity, so
  // gating on opacity alone would still pull every panorama's thumbnail on every page load, even
  // for the ones nobody's zoomed anywhere near
  const [thumbnailsVisible, setThumbnailsVisible] = useState(
    () => viewportScale.get() > PANORAMA_FADE_START_SCALE,
  )
  useMotionValueEvent(viewportScale, "change", (scale) => {
    const next = scale > PANORAMA_FADE_START_SCALE
    setThumbnailsVisible((current) => (current === next ? current : next))
  })

  return (
    <>
      {panoramas.map((panorama) => (
        <motion.button
          key={panorama.uuid}
          type="button"
          aria-label={panorama.caption ?? "Open panorama"}
          onClick={() => {
            triggerHaptic()
            setOpenUuid(panorama.uuid)
          }}
          style={{
            ...positionToStyle(
              latLongToPosition(panorama.latitude, panorama.longitude),
            ),
            opacity,
            scale: counterScale,
            width: MARKER_SIZE_PX,
            height: MARKER_SIZE_PX,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.5),0_6px_16px_rgba(0,0,0,0.55)] ring-4 ring-black/25"
        >
          {/* the thumbnail must never be the thing a tap lands on, or a panorama sitting over a
              pin would swallow taps meant for it — the button itself is the target */}
          <div className="relative size-full overflow-hidden rounded-full corner-squircle border-2 border-white">
            {thumbnailsVisible && (
              <Image
                src={panorama.thumbnailUrl}
                alt=""
                fill
                sizes="34px"
                className="pointer-events-none object-cover"
              />
            )}
          </div>
          {/* a plain round thumbnail reads as just another pin from a distance — this badge is
              what actually says "this one is a panorama" */}
          <span className="pointer-events-none absolute right-0 bottom-0 flex size-3.5 -translate-y-px translate-x-px items-center justify-center rounded-full border border-white bg-black/80">
            <Icon
              icon={ICONS.contributePanorama}
              className="size-2 text-white"
            />
          </span>
        </motion.button>
      ))}

      <Dialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpenUuid(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed top-0 left-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-none bg-black p-0 ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">
            {open?.caption ?? "Panorama"}
          </DialogTitle>
          {open &&
            (open.spherical ? (
              <SphereViewer
                key={open.uuid}
                image={{ kind: "url", url: open.url }}
              />
            ) : (
              <PanoramaScroller panorama={open} />
            ))}

          <IconButton
            icon={ICONS.close}
            tone="overlay"
            onClick={() => setOpenUuid(null)}
            className="absolute top-4 right-4 z-10"
            aria-label="Close"
          />

          {open?.caption && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 max-w-[90vw] -translate-x-1/2 rounded-full corner-squircle bg-black/60 px-4 py-2 text-center text-sm text-white backdrop-blur-sm">
              {open.caption}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// a wide flat photo, so the whole viewer is a horizontal scroller — no 360 library, nothing to
// load before it can show anything. Double-click/tap zooms in to look closer, still pannable
// either way. The drag-with-momentum behavior itself is shared with the capture flow's own
// confirm-step preview via useDragScroll, rather than reimplemented here
function PanoramaScroller({ panorama }: { panorama: MapPanorama }) {
  const { ref: scrollRef, dragging, handlers } = useDragScroll<HTMLDivElement>()
  const [zoomed, setZoomed] = useState(false)

  return (
    <div className="relative h-full w-full">
      {/* absolute + inset-0, not a flex child sized by its content -- a flex item without an
          explicit width shrinks to fit its image instead of the dialog, which quietly turns off
          the whole scroller (nothing left to scroll once the container is already as wide as the
          image) */}
      <div
        ref={scrollRef}
        {...handlers}
        onDoubleClick={() => {
          triggerHaptic()
          setZoomed((current) => !current)
        }}
        className={cn(
          "absolute inset-0 flex touch-pan-x items-center overflow-x-auto overflow-y-hidden select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: intrinsic-width scroller, next/image needs a fixed box */}
        <img
          src={panorama.url}
          alt={panorama.caption ?? ""}
          draggable={false}
          style={{ height: zoomed ? `${ZOOMED_HEIGHT_PERCENT}%` : "100%" }}
          className="max-w-none shrink-0 transition-[height] duration-300 ease-out"
        />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/70 to-transparent" />
    </div>
  )
}
