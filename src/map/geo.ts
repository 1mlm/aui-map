// Everything that converts between real-world coordinates and where things sit on the map image.
// Nothing else in the app should do lat/long arithmetic.

import type { Point } from "./panZoomMath"

// the map image is stitched from satellite tiles to exactly this box, so the box is the source
// of truth and the imagery follows it, rather than the other way round. North-up, no rotation.
// Web Mercator vs a flat lat/long lerp differ by 0.16px over the whole image at this latitude,
// which is why the simple version below is fine.
//
// cropped from the original stitch to the campus + a real margin (a couple hundred meters on
// every side) rather than the forest surrounding it — every pin's coordinates were checked
// against this box before cropping, see public/archived/auimap-3542-original.webp for the
// uncropped source if the crop ever needs revisiting
export const MAP_BOUNDING_BOX = {
  topLat: 33.544681703557316,
  bottomLat: 33.53289291897234,
  leftLong: -5.11292362676454,
  rightLong: -5.098835929136081,
}

export type NormalizedPosition = [x: number, y: number]

// reads the "latitude, longitude" string map items store — the same text you'd copy out of
// Google Maps, so what's in the data file is exactly what the place really is
export function parseCoordinates(coord: string) {
  const [latitude, longitude] = coord.split(",").map((part) => Number(part.trim()))
  if (Number.isNaN(latitude) || Number.isNaN(longitude))
    throw new Error(`Malformed coordinates: "${coord}"`)
  return { latitude, longitude }
}

// real coordinates -> image-relative (0-1 across the whole image), top-left origin
export function latLongToPosition(latitude: number, longitude: number): NormalizedPosition {
  const { topLat, bottomLat, leftLong, rightLong } = MAP_BOUNDING_BOX
  return [
    (longitude - leftLong) / (rightLong - leftLong),
    (latitude - topLat) / (bottomLat - topLat),
  ]
}

// where a point on screen falls inside the map image. `imageBox` is the image's live on-screen
// rect, which the browser has already applied the pan and zoom to, so neither shows up here
export function screenPointToPosition(point: Point, imageBox: DOMRect): NormalizedPosition {
  return [(point.x - imageBox.left) / imageBox.width, (point.y - imageBox.top) / imageBox.height]
}

// image-relative (0-1) -> real coordinates, the exact inverse of latLongToPosition
export function positionToLatLong([x, y]: NormalizedPosition) {
  const { topLat, bottomLat, leftLong, rightLong } = MAP_BOUNDING_BOX
  return {
    latitude: topLat + y * (bottomLat - topLat),
    longitude: leftLong + x * (rightLong - leftLong),
  }
}

// back to the "latitude, longitude" text parseCoordinates reads, at the precision data.ts uses
export function formatCoordinates({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

export function isWithinCampusBounds(latitude: number, longitude: number) {
  const { topLat, bottomLat, leftLong, rightLong } = MAP_BOUNDING_BOX
  return (
    latitude <= topLat && latitude >= bottomLat && longitude >= leftLong && longitude <= rightLong
  )
}

// the fraction values a NormalizedPosition holds are only ever consumed as CSS percentages
export function positionToStyle([x, y]: NormalizedPosition) {
  return { left: `${x * 100}%`, top: `${y * 100}%` }
}
