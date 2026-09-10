// Placeholder per-category building looks, keyed by the real Tag.id values (see prisma/schema
// Tag model). Every number here is a guess to make the first 3D prototype visible — none of it
// is real footprint/height data yet, that's what the future modify editor replaces.
//
// Shapes/roof color are tuned by eye against the actual campus photo (public/auimap-1312.webp):
// almost every building there has a red-tile pitched roof over cream walls, regardless of
// function, so "gable" + TERRACOTTA_ROOF is the default look, not just a housing thing. Flat
// pavement (parking) and open fields (sports) are the exception — those read as ground, not
// buildings.

export type BuildingShapeKind = "gable" | "flat" | "slab" | "domed"

export type BuildingTemplate = {
  shape: BuildingShapeKind
  heightMeters: number
  footprintWidthMeters: number
  footprintDepthMeters: number
  // only meaningful for "gable"/"domed" — "flat"/"slab" have no separate roof mesh
  roofColor: string
}

export const TERRACOTTA_ROOF = "#b9704f"

const DEFAULT_TEMPLATE: BuildingTemplate = {
  shape: "gable",
  heightMeters: 6,
  footprintWidthMeters: 10,
  footprintDepthMeters: 10,
  roofColor: TERRACOTTA_ROOF,
}

// tag id -> placeholder template. parking/sports read as flat ground slabs rather than
// buildings, everything else is a terracotta-roofed volume
const TEMPLATES_BY_TAG_ID: Record<string, BuildingTemplate> = {
  unknownHousing: {
    shape: "gable",
    heightMeters: 9,
    footprintWidthMeters: 18,
    footprintDepthMeters: 12,
    roofColor: TERRACOTTA_ROOF,
  },
  building: {
    shape: "gable",
    heightMeters: 14,
    footprintWidthMeters: 24,
    footprintDepthMeters: 16,
    roofColor: TERRACOTTA_ROOF,
  },
  auditorium: {
    shape: "gable",
    heightMeters: 10,
    footprintWidthMeters: 20,
    footprintDepthMeters: 20,
    roofColor: TERRACOTTA_ROOF,
  },
  food: {
    shape: "gable",
    heightMeters: 4,
    footprintWidthMeters: 8,
    footprintDepthMeters: 8,
    roofColor: TERRACOTTA_ROOF,
  },
  service: {
    shape: "gable",
    heightMeters: 4,
    footprintWidthMeters: 6,
    footprintDepthMeters: 6,
    roofColor: TERRACOTTA_ROOF,
  },
  other: {
    shape: "gable",
    heightMeters: 5,
    footprintWidthMeters: 8,
    footprintDepthMeters: 8,
    roofColor: TERRACOTTA_ROOF,
  },
  sports: {
    shape: "slab",
    heightMeters: 0.3,
    footprintWidthMeters: 22,
    footprintDepthMeters: 32,
    roofColor: TERRACOTTA_ROOF,
  },
  parking: {
    shape: "slab",
    heightMeters: 0.2,
    footprintWidthMeters: 16,
    footprintDepthMeters: 26,
    roofColor: TERRACOTTA_ROOF,
  },
}

export function getBuildingTemplate(tagId: string): BuildingTemplate {
  return TEMPLATES_BY_TAG_ID[tagId] ?? DEFAULT_TEMPLATE
}
