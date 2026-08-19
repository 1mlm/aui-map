import { del, put } from "@vercel/blob"

// used for pin photos, moderation-queue submissions of any file type, and anything else that
// needs a durable public url — the storage side of this doesn't care what kind of file it is
export async function uploadFile(file: File): Promise<string> {
  const blob = await put(`aui-map/${crypto.randomUUID()}-${file.name}`, file, { access: "public" })
  return blob.url
}

// seed data points some attachments at the local placeholder image rather than a real
// blob url — only ever try to delete the ones actually stored in blob
export async function deleteFile(url: string): Promise<void> {
  if (!url.includes(".blob.vercel-storage.com/")) return
  await del(url)
}
