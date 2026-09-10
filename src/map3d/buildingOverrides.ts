// Per-pin exceptions to the per-tag templates in buildingTemplates.ts — for the handful of
// buildings distinctive enough, and easy enough to eyeball off public/auimap-1312.webp, that a
// generic tag template would misrepresent them. Everything else still waits on the real modify
// editor; this is not meant to grow into a full per-building trace.
import type { BuildingTemplate } from "./buildingTemplates"

const TEAL_ROOF = "#3f8f8a"

const OVERRIDES_BY_PIN_ID: Record<string, Partial<BuildingTemplate>> = {
  // the campus's one obviously-domed building — a plain gable would read as just another dorm
  mosque: {
    shape: "domed",
    heightMeters: 8,
    footprintWidthMeters: 15,
    footprintDepthMeters: 15,
  },
  // the pool building's roof is a distinct teal in the actual photo, not the usual terracotta —
  // it's also a real building, not the open field the "sports" tag's default template assumes
  gym: {
    shape: "gable",
    heightMeters: 9,
    footprintWidthMeters: 38,
    footprintDepthMeters: 28,
    roofColor: TEAL_ROOF,
  },
}

export function getBuildingOverride(pinId: string): Partial<BuildingTemplate> {
  return OVERRIDES_BY_PIN_ID[pinId] ?? {}
}
