"use client"

import { type MotionValue, motion, useTransform } from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Dialog, DialogContent, DialogTitle } from "@/shadcn/ui/dialog"
import { triggerHaptic } from "@/utils/haptics"
import { latLongToPosition, positionToStyle } from "./geo"
import type { MapPanorama } from "./types"

// panoramas are scenery, not destinations, so they stay out of the way until someone has zoomed
// into a specific corner of campus. A hard cutoff would pop them in mid-pinch and read as a
// rendering bug, so they fade across this range instead
const PANORAMA_FADE_START_SCALE = 1.9
const PANORAMA_FADE_END_SCALE = 2.4
const MARKER_SIZE_PX = 34

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
          className="absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full corner-squircle border-2 border-white/90 shadow-md shadow-black/40"
        >
          {/* the thumbnail must never be the thing a tap lands on, or a panorama sitting over a
              pin would swallow taps meant for it — the button itself is the target */}
          <Image
            src={panorama.thumbnailUrl}
            alt=""
            fill
            sizes="34px"
            className="pointer-events-none object-cover"
          />
        </motion.button>
      ))}

      <Dialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpenUuid(null)}
      >
        <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-6xl flex-col gap-3 overflow-hidden rounded-[2rem] corner-squircle border-none bg-black/95 p-4 sm:max-w-6xl">
          <DialogTitle className="flex items-center gap-2 text-sm text-white">
            <Icon icon={ICONS.contributePanorama} />
            {open?.caption ?? "Panorama"}
          </DialogTitle>
          {/* a wide flat photo, so the whole viewer is just a horizontal scroller — no 360
              library, nothing to load before it can show anything */}
          {open && (
            <div className="overflow-x-auto overflow-y-hidden">
              {/* biome-ignore lint/performance/noImgElement: intrinsic-width scroller, next/image needs a fixed box */}
              <img
                src={open.url}
                alt={open.caption ?? ""}
                className="h-[70vh] max-w-none rounded-xl corner-squircle"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
