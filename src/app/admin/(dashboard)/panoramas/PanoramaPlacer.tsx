"use client"

import { type ChangeEvent, useRef, useState, useTransition } from "react"
import { FieldLabel } from "@/components/FieldLabel"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { MiniMapPicker, type Placement } from "@/map/MiniMapPicker"
import type { MapPanorama } from "@/map/types"
import { Button } from "@/shadcn/ui/button"
import { Input } from "@/shadcn/ui/input"
import { uploadFile } from "@/utils/cloudinaryUpload"
import { createPanorama, deletePanorama, movePanorama } from "./actions"

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
      const uploaded = await uploadFile(file, {
        signUrl: "/api/contribute/upload",
      })
      const result = await createPanorama({
        rawUrl: uploaded.url,
        latitude: draft.latitude,
        longitude: draft.longitude,
        caption: caption.trim() || null,
        heading: null,
        spherical: false,
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

  const selected = panoramas.find((panorama) => panorama.uuid === selectedUuid)

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

      <MiniMapPicker
        value={draft}
        markers={panoramas.map((panorama) => ({
          id: panorama.uuid,
          latitude: panorama.latitude,
          longitude: panorama.longitude,
          selected: panorama.uuid === selectedUuid,
        }))}
        onPick={handlePlace}
        onSelectMarker={(id) =>
          setSelectedUuid((current) => (current === id ? null : id))
        }
      />
    </div>
  )
}
