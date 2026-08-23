import { del } from "@vercel/blob"

// seed data points some attachments at the local placeholder image rather than a real
// blob url — only ever try to delete the ones actually stored in blob
export async function deleteFile(url: string): Promise<void> {
  if (!url.includes(".blob.vercel-storage.com/")) return
  await del(url)
}
