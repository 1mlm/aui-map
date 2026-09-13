// authored terrain height, read from terrainHeightmap.json -- a flat {rows, cols, heights} grid
// (every height 0 right now). Both the ground mesh (Terrain.tsx) and anything placed on it
// (Building.tsx) read height from this same function, so buildings sit flush with the ground
// instead of floating or clipping.
//
// this used to sample real satellite relief (Open-Elevation/SRTM, baked to elevationGrid.json) --
// that file is still on disk if a future pass wants to reintroduce real topography, it's just not
// the active data source right now.
import { MAP_METERS_SIZE } from "@/map/geo"
import terrainHeightmap from "./terrainHeightmap.json"

// how far past the campus bounding box the grid (and the ground mesh) extends on every side
export const TERRAIN_EXPANSION = 1.6

// the grid's own resolution -- Terrain.tsx's PlaneGeometry segment count must match these minus
// one exactly
export const TERRAIN_GRID_ROWS = terrainHeightmap.rows
export const TERRAIN_GRID_COLS = terrainHeightmap.cols

const heights: number[] = terrainHeightmap.heights

function sampleGridHeight(row: number, col: number) {
  const clampedRow = Math.min(TERRAIN_GRID_ROWS - 1, Math.max(0, row))
  const clampedCol = Math.min(TERRAIN_GRID_COLS - 1, Math.max(0, col))
  return heights[clampedRow * TERRAIN_GRID_COLS + clampedCol]
}

export function getTerrainHeightAt(x: number, z: number): number {
  const worldWidth = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
  const worldHeight = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
  const u = x / worldWidth + 0.5
  const v = z / worldHeight + 0.5
  const colF = u * (TERRAIN_GRID_COLS - 1)
  const rowF = v * (TERRAIN_GRID_ROWS - 1)
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
  return lerp(top, bottom, rowFraction)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
