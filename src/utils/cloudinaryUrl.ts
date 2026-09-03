// pure string manipulation on a Cloudinary delivery url — safe to call from client components,
// unlike utils/cloudinary.ts which configures the SDK with API secrets. Inserting a transformation
// segment right after "/upload/" makes Cloudinary itself resize/compress the image at its CDN edge
// instead of the origin handing over the full original on every request
export function withCloudinaryTransform(url: string, transformation: string) {
  if (!url.includes("res.cloudinary.com")) return url
  return url.replace("/upload/", `/upload/${transformation}/`)
}

// a small square thumbnail (attachment strips, admin grids) never needs more than ~2x the
// display size handed over the wire — q_auto/f_auto let Cloudinary pick the smallest format and
// quality a viewer's browser can render
export function cloudinaryThumbnail(url: string, displayPx: number) {
  return withCloudinaryTransform(url, `w_${displayPx * 2},c_fill,q_auto,f_auto`)
}

// the full lightbox view still wants the real resolution — this only swaps in Cloudinary's
// auto format/quality picker, which is free bytes saved with no visible loss
export function cloudinaryOptimized(url: string) {
  return withCloudinaryTransform(url, "q_auto,f_auto")
}
