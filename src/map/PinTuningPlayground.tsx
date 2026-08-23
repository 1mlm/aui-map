"use client"

import { useControls } from "leva"
import type { PinSizeTuning } from "./MapPin"

// dev-only tool (see the dynamic-import gate in MapExperience.tsx) — lets you retune how pins
// shrink on zoom and when their tooltip stays open on its own, live against the real map, before
// deciding what to commit as the new defaults. Never ships to real visitors: the whole component
// is behind a NODE_ENV check + next/dynamic
export function PinTuningPlayground({
  tuning,
  onTuningChange,
}: {
  tuning: PinSizeTuning
  onTuningChange: (tuning: PinSizeTuning) => void
}) {
  useControls("Pin size & labels", {
    growthExponent: {
      value: tuning.growthExponent,
      min: -1,
      max: 0.7,
      step: 0.05,
      label: "shrink amount",
      onChange: (growthExponent: number) =>
        onTuningChange({ ...tuning, growthExponent }),
    },
    tooltipShowScale: {
      value: tuning.tooltipShowScale,
      min: 1.45,
      max: 5,
      step: 0.05,
      label: "tooltip zoom threshold",
      onChange: (tooltipShowScale: number) =>
        onTuningChange({ ...tuning, tooltipShowScale }),
    },
    pinOpacity: {
      value: tuning.pinOpacity,
      min: 0.3,
      max: 1,
      step: 0.01,
      label: "pin opacity",
      onChange: (pinOpacity: number) =>
        onTuningChange({ ...tuning, pinOpacity }),
    },
  })

  return null
}
