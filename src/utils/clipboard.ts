// navigator.clipboard.writeText can reject — clipboard permission denied, an insecure context, a
// browser that just doesn't feel like it — and every caller here was letting that reject uncaught,
// which surfaces as a crash overlay instead of the copy silently not happening
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// same as above but for an image blob (e.g. a generated QR code) — the Clipboard API only
// accepts a handful of image mime types, png is the one every OS paste target understands
export async function copyImageToClipboard(blob: Blob) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
    return true
  } catch {
    return false
  }
}
