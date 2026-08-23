"use client"

import { useControls } from "leva"
import type { PinSizeTuning } from "./MapPin"

// dev-only tool (see the dynamic-import gate in MapExperience.tsx) — lets you retune how pins
// shrink on zoom and when/how their name label appears, live against the real map, before
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
      min: -3,
      max: 3,
      step: 0.05,
      label: "shrink amount",
      onChange: (growthExponent: number) =>
        onTuningChange({ ...tuning, growthExponent }),
    },
    labelShowScale: {
      value: tuning.labelShowScale,
      min: 0.5,
      max: 15,
      step: 0.05,
      label: "label zoom threshold",
      onChange: (labelShowScale: number) =>
        onTuningChange({ ...tuning, labelShowScale }),
    },
    labelFontSize: {
      value: tuning.labelFontSize,
      min: 4,
      max: 120,
      step: 0.5,
      label: "label font size",
      onChange: (labelFontSize: number) =>
        onTuningChange({ ...tuning, labelFontSize }),
    },
    labelStrokeWidth: {
      value: tuning.labelStrokeWidth,
      min: 0,
      max: 25,
      step: 0.25,
      label: "label outline width",
      onChange: (labelStrokeWidth: number) =>
        onTuningChange({ ...tuning, labelStrokeWidth }),
    },
    pinOpacity: {
      value: tuning.pinOpacity,
      min: 0,
      max: 1,
      step: 0.01,
      label: "pin opacity",
      onChange: (pinOpacity: number) =>
        onTuningChange({ ...tuning, pinOpacity }),
    },
  })

  return null
}
