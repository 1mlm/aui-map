"use client"

import { useControls } from "leva"
import {
  CURATED_TAG_COLORS,
  type CrayonTuning,
  type TagColorName,
} from "./tagColor"
import type { MapItemTag } from "./types"

// dev-only tool (see the dynamic-import gate in MapExperience.tsx) — lets you try every tag on
// every color live against the real map before deciding what to commit to the db. Never ships
// to real visitors: the whole component is behind a NODE_ENV check + next/dynamic
export function TagColorPlayground({
  tags,
  tuning,
  onColorChange,
  onTuningChange,
}: {
  tags: MapItemTag[]
  tuning: CrayonTuning
  onColorChange: (tagId: string, color: TagColorName) => void
  onTuningChange: (tuning: CrayonTuning) => void
}) {
  useControls(
    "Tag colors",
    Object.fromEntries(
      tags.map((tag) => [
        tag.label,
        {
          value: tag.color ?? "grey",
          options: CURATED_TAG_COLORS,
          onChange: (color: TagColorName) => onColorChange(tag.id, color),
        },
      ]),
    ),
  )

  // the two knobs behind tagPinFillColor's "crayon" treatment — lightness/chroma are pinned the
  // same for every hue, so retuning them here previews every pin's color at once
  useControls("Pin tuning", {
    lightness: {
      value: tuning.lightness,
      min: 0,
      max: 100,
      step: 1,
      onChange: (lightness: number) =>
        onTuningChange({ lightness, chroma: tuning.chroma }),
    },
    chroma: {
      value: tuning.chroma,
      min: 0,
      max: 0.4,
      step: 0.01,
      onChange: (chroma: number) =>
        onTuningChange({ lightness: tuning.lightness, chroma }),
    },
  })

  return null
}
