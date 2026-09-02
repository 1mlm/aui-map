import { NextResponse } from "next/server"
import { uploadBuffer } from "@/utils/cloudinary"

// registered as the PWA's Web Share Target (see share_target in src/app/manifest.ts) — lets
// someone share a link/photo from another app straight into aui-map's feedback form, instead of
// only being able to open the form and type from scratch. The shared file (if any) is uploaded
// here, server-side, since a share_target POST can't be handed off to the client — the redirect
// below just carries its resulting URL, not the file itself, back to the page as query params for
// NoticeDialog to read once and pass into SuggestionForm as a prefill
export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData()
  const title = formData.get("title")
  const text = formData.get("text")
  const sharedUrl = formData.get("url")
  const media = formData.get("media")

  const message = [title, text, sharedUrl]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    )
    .join("\n")

  const redirectUrl = new URL("/", request.url)
  if (message) redirectUrl.searchParams.set("sharedText", message)

  if (media instanceof File && media.size > 0) {
    const uploaded = await uploadBuffer(Buffer.from(await media.arrayBuffer()))
    redirectUrl.searchParams.set("sharedFileUrl", uploaded.secure_url)
    redirectUrl.searchParams.set("sharedFileName", media.name)
    redirectUrl.searchParams.set("sharedMimeType", media.type)
  }

  return NextResponse.redirect(redirectUrl, 303)
}
