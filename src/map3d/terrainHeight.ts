// real elevation for the campus and a margin around it, fetched once from the Open-Elevation API
// (SRTM-based, free, no key) as a grid over EXPANSION * MAP_METERS_SIZE and baked to
// elevationGrid.json as meters relative to the grid's own mean — see the fetch script this was
// generated from, noted in the 3D map backlog entry. Both the ground mesh (Terrain.tsx) and
// anything placed on it (Building.tsx) read height from this same function, so buildings sit
// flush with the ground instead of floating or clipping into it.
import { MAP_METERS_SIZE } from "@/map/geo"
import elevationGrid from "./elevationGrid.json"

// how far past the campus bounding box the grid (and the ground mesh) extends on every side
export const TERRAIN_EXPANSION = 1.6

// real relief at true 1:1 scale (confirmed ~19m across the building cluster) is only a ~5% grade
// — genuinely too subtle to read from an isometric camera. Exaggerating vertical scale is the
// standard fix in terrain rendering generally, not a "fake it" move; every stylized/game terrain
// view does this because true-scale relief looks flat from any reasonable viewing angle
const VERTICAL_EXAGGERATION = 2.5

const { rows, cols, heights } = elevationGrid

function sampleGridHeight(row: number, col: number) {
  const clampedRow = Math.min(rows - 1, Math.max(0, row))
  const clampedCol = Math.min(cols - 1, Math.max(0, col))
  return heights[clampedRow * cols + clampedCol]
}

export function getTerrainHeightAt(x: number, z: number): number {
  const worldWidth = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
  const worldHeight = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
  const u = x / worldWidth + 0.5
  const v = z / worldHeight + 0.5
  const colF = u * (cols - 1)
  const rowF = v * (rows - 1)
  const row0 = Math.floor(rowF)
  const col0 = Math.floor(colF)
  const rowFraction = rowF - row0
  const colFraction = colF - col0

  // bilinear interpolation between the 4 grid points surrounding (x, z)
  const top = lerp(
    sampleGridHeight(row0, col0),
    sampleGridHeight(row0, col0 + 1),
    colFraction,
  )
  const bottom = lerp(
    sampleGridHeight(row0 + 1, col0),
    sampleGridHeight(row0 + 1, col0 + 1),
    colFraction,
  )
  const realHeight = lerp(top, bottom, rowFraction) + getDetailNoiseAt(x, z)
  return realHeight * VERTICAL_EXAGGERATION
}

// the real grid is real, but its points are ~80m apart and bilinear-interpolated between them —
// smooth in a way that reads as a fake, low-detail blob up close. This layers small, high-frequency
// texture on top (a fraction of a meter, well under the grid's own resolution) so the ground
// doesn't distort the real macro shape but stops looking dead-smooth
const DETAIL_NOISE_AMPLITUDE_METERS = 0.4
const DETAIL_NOISE_WAVELENGTH_METERS = 14

function getDetailNoiseAt(x: number, z: number) {
  return (
    Math.sin(x / DETAIL_NOISE_WAVELENGTH_METERS + z * 0.7) *
    Math.cos(z / DETAIL_NOISE_WAVELENGTH_METERS - x * 0.3) *
    DETAIL_NOISE_AMPLITUDE_METERS
  )
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
