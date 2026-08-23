"use client"

import { useControls } from "leva"
import { CURATED_TAG_COLORS, type TagColorName } from "./tagColor"
import type { MapItemTag } from "./types"

// dev-only tool (see the dynamic-import gate in MapExperience.tsx) — lets you try every tag on
// every color live against the real map before deciding what to commit to the db. Never ships
// to real visitors: the whole component is behind a NODE_ENV check + next/dynamic
export function TagColorPlayground({
  tags,
  onColorChange,
}: {
  tags: MapItemTag[]
  onColorChange: (tagId: string, color: TagColorName) => void
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

  return null
}
