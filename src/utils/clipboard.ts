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
