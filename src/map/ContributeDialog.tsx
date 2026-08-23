"use client"

import { upload } from "@vercel/blob/client"
import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { FieldLabel } from "@/components/FieldLabel"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { Textarea } from "@/shadcn/ui/textarea"
import { triggerHaptic } from "@/utils/haptics"
import {
  iconForMimeType,
  isImageMimeType,
  isVideoMimeType,
} from "@/utils/mimeType"
import { submitContribution } from "./contributeActions"

const SUCCESS_CLOSE_DELAY_MS = 1600

function FilePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!previewUrl) return null

  if (isImageMimeType(file.type)) {
    // biome-ignore lint/performance/noImgElement: local blob: preview, next/image can't load blob urls
    return (
      <img
        src={previewUrl}
        alt=""
        className="max-h-40 w-full rounded-xl corner-squircle object-cover"
      />
    )
  }

  if (isVideoMimeType(file.type)) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: local preview of a file that hasn't been submitted yet
      <video
        src={previewUrl}
        controls
        playsInline
        className="max-h-40 w-full rounded-xl corner-squircle"
      />
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl corner-squircle border border-border p-3 text-muted-foreground">
      <Icon icon={iconForMimeType(file.type)} className="shrink-0" />
      <span className="truncate text-sm">{file.name}</span>
    </div>
  )
}

export function ContributeDialog({
  pinId,
  pinTitle,
  open,
  onOpenChange,
}: {
  pinId: string
  pinTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  function handleSubmit() {
    if (!file) {
      setError("Choose a file first.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        // uploads straight to Blob storage from the browser (bypasses the 4.5mb body limit a
        // server action would hit), then just tells the db the file landed
        const blob = await upload(
          `aui-map/${crypto.randomUUID()}-${file.name}`,
          file,
          {
            access: "public",
            handleUploadUrl: "/api/contribute/upload",
            multipart: true,
          },
        )
        await submitContribution(
          pinId,
          { url: blob.url, fileName: file.name, mimeType: file.type || null },
          caption.trim() || null,
        )
        triggerHaptic("success")
        setSubmitted(true)
        setTimeout(() => {
          onOpenChange(false)
          setSubmitted(false)
          setFile(null)
          setCaption("")
        }, SUCCESS_CLOSE_DELAY_MS)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't send that — try again.",
        )
      }
    })
  }

  return (
    <Dialog {...{ open, onOpenChange }}>
      <DialogContent className="corner-squircle sm:max-w-sm">
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Icon icon={ICONS.success} className="size-8 text-green-500" />
            <p className="text-sm font-medium">Thanks! Sent for review.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon icon={ICONS.contribute} />
                Contribute a file
              </DialogTitle>
              <DialogDescription>
                Suggest a photo, menu, floor plan, or anything else useful for{" "}
                {pinTitle}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {file ? (
                <div className="flex flex-col gap-1.5">
                  <FilePreview {...{ file }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-between gap-2 rounded-full corner-squircle px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 font-medium">Change</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-xl corner-squircle border border-dashed border-border py-6 text-muted-foreground hover:bg-muted"
                >
                  <Icon icon={ICONS.upload} />
                  <span className="text-sm">Choose a file</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col gap-1.5">
                <FieldLabel icon={ICONS.caption} htmlFor="contribute-caption">
                  Caption
                </FieldLabel>
                <Textarea
                  id="contribute-caption"
                  placeholder="The restaurant menu, what it looks like inside, a panorama…"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  className="corner-squircle"
                />
              </div>
              <FormError>{error}</FormError>
              <Button
                className="w-full rounded-full corner-squircle"
                disabled={pending}
                onClick={handleSubmit}
              >
                <Icon icon={ICONS.send} />
                {pending ? "Sending…" : "Send"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
