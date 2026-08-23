"use client"

import type { ClipboardEvent } from "react"
import { FieldLabel } from "@/components/FieldLabel"
import { ICONS } from "@/icons"
import { Input } from "@/shadcn/ui/input"

// matches the format the app's own "Copy coordinates" buttons produce (MapDetailPanel,
// MapCanvas): "34.123456, -5.123456" — pasting one of those into either field fills both
const COORDINATE_PAIR = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/

// NaN is the "empty" sentinel for a coordinate that hasn't been filled in yet — keeps the
// value type plain `number` (matching the saved-pin shape) instead of widening to `number | null`
const inputTextToCoordinate = (text: string) =>
  text === "" ? Number.NaN : Number(text)

export function PinPositionEditor({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number
  longitude: number
  onChange: (position: { latitude: number; longitude: number }) => void
}) {
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").trim()
    const match = pasted.match(COORDINATE_PAIR)
    if (!match) return
    event.preventDefault()
    onChange({ latitude: Number(match[1]), longitude: Number(match[2]) })
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={ICONS.target} htmlFor="pin-latitude">
          Latitude
        </FieldLabel>
        <Input
          id="pin-latitude"
          type="number"
          step="any"
          placeholder="e.g. 33.53667"
          value={Number.isNaN(latitude) ? "" : latitude}
          onChange={(e) =>
            onChange({
              latitude: inputTextToCoordinate(e.target.value),
              longitude,
            })
          }
          onPaste={handlePaste}
          className="corner-squircle"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={ICONS.target} htmlFor="pin-longitude">
          Longitude
        </FieldLabel>
        <Input
          id="pin-longitude"
          type="number"
          step="any"
          placeholder="e.g. -5.10861"
          value={Number.isNaN(longitude) ? "" : longitude}
          onChange={(e) =>
            onChange({
              latitude,
              longitude: inputTextToCoordinate(e.target.value),
            })
          }
          onPaste={handlePaste}
          className="corner-squircle"
        />
      </div>
    </div>
  )
}
