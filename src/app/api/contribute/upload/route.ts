import { type HandleUploadBody, handleUpload } from "@vercel/blob/client"
import { NextResponse } from "next/server"

// public — anyone on the map can suggest a file for a pin, no auth required (mirrors
// contributeActions.ts's submitContribution, which validates the pin and writes the
// Submission row once the client tells it the upload finished)
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({ addRandomSuffix: true }),
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    )
  }
}
