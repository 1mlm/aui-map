import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// one folder for everything the app uploads, mirroring the old flat "aui-map/" blob prefix
const UPLOAD_FOLDER = "aui-map"

// mints what a browser needs to upload straight to Cloudinary itself (bypassing the 4.5mb body
// limit a server action/route would hit) without ever seeing the API secret — the client sends
// exactly these signed params back alongside the file, and Cloudinary re-derives the signature
// itself to check nothing was tampered with
export function createUploadSignature() {
  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { folder: UPLOAD_FOLDER, timestamp },
    process.env.CLOUDINARY_API_SECRET as string,
  )
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    folder: UPLOAD_FOLDER,
  }
}

// server-side upload for files already in hand (a share-target POST, or a derived webp buffer) —
// nothing routes through the 4.5mb body limit here since the bytes never left the server
export function uploadBuffer(
  buffer: Buffer,
  options: { publicId?: string } = {},
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: UPLOAD_FOLDER,
        public_id: options.publicId,
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed."))
        else resolve(result)
      },
    )
    stream.end(buffer)
  })
}

// a Cloudinary delivery url looks like .../<resource_type>/upload/v<version>/<public_id>.<ext> —
// image and video public ids drop the extension, raw ones (pdfs, anything non-image/video) keep
// it. Both the resource type and the id have to round-trip correctly or destroy() 404s silently
const DELIVERY_URL_PATTERN = /\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/

function parseDeliveryUrl(url: string) {
  const match = url.match(DELIVERY_URL_PATTERN)
  if (!match) return null
  const [, resourceType, rest] = match
  const publicId = resourceType === "raw" ? rest : rest.replace(/\.[^/.]+$/, "")
  return { resourceType: resourceType as "image" | "video" | "raw", publicId }
}

// seed data points some attachments at the local placeholder image rather than a real Cloudinary
// url — only ever try to delete the ones actually stored there
export async function deleteFile(url: string): Promise<void> {
  if (!url.includes("res.cloudinary.com")) return
  const parsed = parseDeliveryUrl(url)
  if (!parsed) return
  await cloudinary.uploader.destroy(parsed.publicId, {
    resource_type: parsed.resourceType,
  })
}
