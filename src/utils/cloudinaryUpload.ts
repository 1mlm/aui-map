import { isImageMimeType, isVideoMimeType } from "./mimeType"

type UploadSignature = {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

async function fetchSignature(signUrl: string): Promise<UploadSignature> {
  const response = await fetch(signUrl, { method: "POST" })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? "Upload failed.")
  }
  return response.json()
}

// Cloudinary only auto-detects between image and video at its "auto" endpoint — anything else
// (pdfs, floor plans, whatever a contributor attaches) has to go to "raw" explicitly or it 400s
function resourceTypeFor(mimeType: string) {
  return isImageMimeType(mimeType) || isVideoMimeType(mimeType) ? "auto" : "raw"
}

// uploads straight from the browser to Cloudinary itself (bypassing the 4.5mb body limit a
// server action/route would hit), using a short-lived signature minted by `signUrl` so the API
// secret never reaches the client. Mirrors the old @vercel/blob/client `upload()` shape closely
// enough that call sites barely changed
export async function uploadFile(
  file: File,
  {
    signUrl,
    onUploadProgress,
  }: {
    signUrl: string
    onUploadProgress?: (progress: { percentage: number }) => void
  },
): Promise<{ url: string }> {
  const { signature, timestamp, apiKey, cloudName, folder } =
    await fetchSignature(signUrl)

  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", apiKey)
  formData.append("timestamp", String(timestamp))
  formData.append("signature", signature)
  formData.append("folder", folder)

  const resourceType = resourceTypeFor(file.type)

  // fetch has no reliable cross-browser upload-progress event, so this uses XHR just for that —
  // AttachmentManager's progress bar needs it for the big files this path exists for in the first place
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    )
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onUploadProgress?.({ percentage: (event.loaded / event.total) * 100 })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { secure_url: string }
        resolve({ url: data.secure_url })
      } else {
        reject(new Error("Upload failed."))
      }
    }
    xhr.onerror = () => reject(new Error("Upload failed."))
    xhr.send(formData)
  })
}
