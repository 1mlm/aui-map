"use client"

import { upload } from "@vercel/blob/client"
import Image from "next/image"
import { type ChangeEvent, useRef, useState, useTransition } from "react"
import { FieldLabel } from "@/components/FieldLabel"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import {
  latLongToPosition,
  positionToLatLong,
  positionToStyle,
  screenPointToPosition,
} from "@/map/geo"
import type { MapPanorama } from "@/map/types"
import { Button } from "@/shadcn/ui/button"
import { Input } from "@/shadcn/ui/input"
import { createPanorama, deletePanorama, movePanorama } from "./actions"

type Placement = { latitude: number; longitude: number }

// the map is the placement control: clicking it is how a panorama gets its coordinates, and
// dragging an existing marker is how one gets corrected. Reading a lat/long out of the photo's
// EXIF would only ever be a prefill, and phones strip it often enough that the click has to work
// on its own anyway
function PlacementMap({
  panoramas,
  draft,
  selectedUuid,
  onPlace,
  onSelect,
}: {
  panoramas: MapPanorama[]
  draft: Placement | null
  selectedUuid: string | null
  onPlace: (placement: Placement) => void
  onSelect: (uuid: string | null) => void
}) {
  const imageRef = useRef<HTMLImageElement>(null)

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    const box = imageRef.current?.getBoundingClientRect()
    if (!box) return
    const position = screenPointToPosition(
      { x: event.clientX, y: event.clientY },
      box,
    )
    onPlace(positionToLatLong(position))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative block w-full cursor-crosshair overflow-hidden rounded-xl corner-squircle border border-border"
    >
      <Image
        ref={imageRef}
        src="/auimap-1312.webp"
        alt="Campus map"
        width={1312}
        height={1312}
        className="w-full"
      />
      {panoramas.map((panorama) => (
        <span
          key={panorama.uuid}
          onPointerDown={(event) => {
            event.stopPropagation()
            onSelect(panorama.uuid === selectedUuid ? null : panorama.uuid)
          }}
          style={positionToStyle(
            latLongToPosition(panorama.latitude, panorama.longitude),
          )}
          className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            panorama.uuid === selectedUuid
              ? "border-primary bg-primary/60"
              : "border-white bg-black/60"
          }`}
        />
      ))}
      {draft && (
        <span
          style={positionToStyle(
            latLongToPosition(draft.latitude, draft.longitude),
          )}
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-primary bg-primary"
        />
      )}
    </button>
  )
}

export function PanoramaPlacer({ panoramas }: { panoramas: MapPanorama[] }) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [draft, setDraft] = useState<Placement | null>(null)
  const [caption, setCaption] = useState("")
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null
    setFile(picked)
    setPreviewUrl(picked ? URL.createObjectURL(picked) : null)
  }

  // clicking the map means "put the new one here" while a file is staged, and "move the selected
  // one here" otherwise — one gesture, and which it is follows from what's already in hand
  function handlePlace(placement: Placement) {
    if (file) {
      setDraft(placement)
      return
    }
    if (!selectedUuid) return
    startTransition(async () => {
      const result = await movePanorama(
        selectedUuid,
        placement.latitude,
        placement.longitude,
      )
      setError(result.error)
    })
  }

  function handleSave() {
    if (!file) {
      setError("Choose a panorama first.")
      return
    }
    if (!draft) {
      setError("Click the map to say where it was taken.")
      return
    }
    setError(null)
    startTransition(async () => {
      const blob = await upload(
        `aui-map/raw-${crypto.randomUUID()}-${file.name}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/contribute/upload",
          multipart: true,
        },
      )
      const result = await createPanorama({
        rawUrl: blob.url,
        latitude: draft.latitude,
        longitude: draft.longitude,
        caption: caption.trim() || null,
        heading: null,
      })
      setError(result.error)
      if (!result.error) {
        setFile(null)
        setPreviewUrl(null)
        setDraft(null)
        setCaption("")
      }
    })
  }

  const selected = panoramas.find(
    (panorama) => panorama.uuid === selectedUuid,
  )

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        {previewUrl ? (
          <div className="overflow-x-auto rounded-xl corner-squircle border border-border">
            {/* biome-ignore lint/performance/noImgElement: local blob: preview, next/image can't load blob urls */}
            <img src={previewUrl} alt="" className="h-40 max-w-none" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 rounded-xl corner-squircle border border-dashed border-border py-10 text-muted-foreground hover:bg-muted"
          >
            <Icon icon={ICONS.contributePanorama} className="size-6" />
            <span className="text-sm">Choose a panorama</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.caption} htmlFor="panorama-caption">
            Caption
          </FieldLabel>
          <Input
            id="panorama-caption"
            placeholder="Looking down the main walkway"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="corner-squircle"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {file
            ? "Click the map to drop it where it was taken."
            : "Click a marker to select it, then click the map to move it."}
        </p>

        <FormError>{error}</FormError>

        <div className="flex gap-2">
          <Button
            className="flex-1 corner-squircle"
            disabled={pending}
            onClick={handleSave}
          >
            <Icon icon={ICONS.send} />
            {pending ? "Saving…" : "Save panorama"}
          </Button>
          {selected && (
            <Button
              variant="outline"
              className="corner-squircle"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deletePanorama(selected.uuid)
                  setError(result.error)
                  setSelectedUuid(null)
                })
              }
            >
              <Icon icon={ICONS.close} />
              Delete selected
            </Button>
          )}
        </div>
      </div>

      <PlacementMap
        onPlace={handlePlace}
        onSelect={setSelectedUuid}
        {...{ panoramas, draft, selectedUuid }}
      />
    </div>
  )
}
