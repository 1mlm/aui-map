"use client"

import { Leva, useControls } from "leva"
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
    pinBaseSizePx: {
      value: tuning.pinBaseSizePx,
      min: 8,
      max: 96,
      step: 1,
      label: "pin base size",
      onChange: (pinBaseSizePx: number) => onTuningChange({ pinBaseSizePx }),
    },
    labelGapPx: {
      value: tuning.labelGapPx,
      min: -20,
      max: 60,
      step: 1,
      label: "label gap",
      onChange: (labelGapPx: number) => onTuningChange({ labelGapPx }),
    },
    labelFontSize: {
      value: tuning.labelFontSize,
      min: 4,
      max: 120,
      step: 0.5,
      label: "label font size",
      onChange: (labelFontSize: number) => onTuningChange({ labelFontSize }),
    },
    labelFontFamily: {
      value: tuning.labelFontFamily,
      options: { Normal: "sans", Monospace: "mono" },
      label: "label font",
      onChange: (labelFontFamily: "sans" | "mono") =>
        onTuningChange({ labelFontFamily }),
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
    pinStrokeWidth: {
      value: tuning.pinStrokeWidth,
      min: 0,
      max: 4,
      step: 0.05,
      label: "pin outline width",
      onChange: (pinStrokeWidth: number) => onTuningChange({ pinStrokeWidth }),
    },
    innerIconFraction: {
      value: tuning.innerIconFraction,
      min: 0,
      max: 0.8,
      step: 0.01,
      label: "tag icon size",
      onChange: (innerIconFraction: number) =>
        onTuningChange({ innerIconFraction }),
    },
    innerIconStrokeWidth: {
      value: tuning.innerIconStrokeWidth,
      min: 0.5,
      max: 6,
      step: 0.1,
      label: "tag icon weight",
      onChange: (innerIconStrokeWidth: number) =>
        onTuningChange({ innerIconStrokeWidth }),
    },
  })

  // the implicit auto-mounted panel leva spawns from useControls alone uses its default theme
  // (small text, narrow column) — rendering our own <Leva> takes over that panel and lets it be
  // sized for an actual dev tuning by hand, not a corner-of-screen debug readout
  return (
    <Leva
      oneLineLabels
      theme={{
        fontSizes: { root: "16px" },
        sizes: { rootWidth: "340px", controlWidth: "160px" },
      }}
    />
  )
}
