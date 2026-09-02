import { NextResponse } from "next/server"
import { createUploadSignature } from "@/utils/cloudinary"

// public — anyone on the map can suggest a file for a pin, no auth required (mirrors
// contributeActions.ts's submitContribution, which validates the pin and writes the
// Submission row once the client tells it the upload finished)
export function POST(): NextResponse {
  return NextResponse.json(createUploadSignature())
}
