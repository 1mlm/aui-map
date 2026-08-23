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
  // a patch, not the whole object — leva only rebinds these onChange closures when the
  // schema's own keys change, not on every parent re-render, so a closure that spread the
  // full `tuning` here would spread a stale snapshot and stomp every other field back to
  // whatever tuning was at that snapshot the moment any one slider moved
  onTuningChange: (patch: Partial<PinSizeTuning>) => void
}) {
  useControls("Pin size & labels", {
    growthExponent: {
      value: tuning.growthExponent,
      min: -3,
      max: 3,
      step: 0.05,
      label: "shrink amount",
      onChange: (growthExponent: number) => onTuningChange({ growthExponent }),
    },
    labelShowScale: {
      value: tuning.labelShowScale,
      min: 0.5,
      max: 15,
      step: 0.05,
      label: "label zoom threshold",
      onChange: (labelShowScale: number) => onTuningChange({ labelShowScale }),
    },
    labelFontSize: {
      value: tuning.labelFontSize,
      min: 4,
      max: 120,
      step: 0.5,
      label: "label font size",
      onChange: (labelFontSize: number) => onTuningChange({ labelFontSize }),
    },
    labelStrokeWidth: {
      value: tuning.labelStrokeWidth,
      min: 0,
      max: 25,
      step: 0.25,
      label: "label outline width",
      onChange: (labelStrokeWidth: number) =>
        onTuningChange({ labelStrokeWidth }),
    },
    pinOpacity: {
      value: tuning.pinOpacity,
      min: 0,
      max: 1,
      step: 0.01,
      label: "pin opacity",
      onChange: (pinOpacity: number) => onTuningChange({ pinOpacity }),
    },
  })

  return null
}
