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
import type { SubmissionKind } from "@/generated/prisma/client"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { Input } from "@/shadcn/ui/input"
import { Textarea } from "@/shadcn/ui/textarea"
import { cn } from "@/shadcn/utils"
import { extractErrorMessage } from "@/utils/error"
import { triggerHaptic } from "@/utils/haptics"
import {
  iconForMimeType,
  isImageMimeType,
  isVideoMimeType,
} from "@/utils/mimeType"
import { submitContribution } from "./contributeActions"

const SUCCESS_CLOSE_DELAY_MS = 1600

// one row per thing someone can contribute. Everything downstream — the picker cards, which
// fields the form shows, what the server writes — reads off this, so adding a fifth kind is an
// entry here plus a value on the SubmissionKind enum, not a fifth bespoke dialog
const CONTRIBUTION_TYPES = [
  {
    kind: "ATTACHMENT",
    icon: ICONS.photos,
    label: "A photo or file",
    blurb: "A picture, a menu, a floor plan — anything useful about a place.",
    needsPin: true,
    fields: { file: true, caption: true },
  },
  {
    kind: "PANORAMA",
    icon: ICONS.contributePanorama,
    label: "A panorama",
    blurb: "A wide shot of campus. It gets placed on the map, not on a pin.",
    needsPin: false,
    fields: { file: true, caption: true },
  },
  {
    kind: "NEW_PIN",
    icon: ICONS.contributeNewPin,
    label: "A missing place",
    blurb: "Something that should be on the map but isn't yet.",
    needsPin: false,
    fields: { title: true, message: true },
  },
  {
    kind: "PIN_EDIT",
    icon: ICONS.contributeEdit,
    label: "A correction",
    blurb: "Wrong name, wrong spot, outdated hours — tell me what's off.",
    needsPin: true,
    fields: { message: true },
  },
] as const satisfies readonly {
  kind: SubmissionKind
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  blurb: string
  needsPin: boolean
  fields: { file?: true; caption?: true; title?: true; message?: true }
}[]

type ContributionType = (typeof CONTRIBUTION_TYPES)[number]

export type ContributePin = { id: string; title: string }

function FilePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!previewUrl) return null

  if (isImageMimeType(file.type)) {
    return (
      // biome-ignore lint/performance/noImgElement: local blob: preview, next/image can't load blob urls
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

function ContributionPicker({
  pin,
  onPick,
}: {
  pin: ContributePin | null
  onPick: (type: ContributionType) => void
}) {
  // the two pin-bound kinds are only answerable about a place you already have open, so from the
  // map's global button they'd be a dead end asking "which pin?" with no way to say
  const offered = CONTRIBUTION_TYPES.filter((type) => pin || !type.needsPin)

  return (
    <div className="flex flex-col gap-2">
      {offered.map((type) => (
        <button
          key={type.kind}
          type="button"
          onClick={() => {
            triggerHaptic()
            onPick(type)
          }}
          className="flex items-center gap-3 rounded-xl corner-squircle border border-border p-3 text-left transition-colors hover:bg-muted"
        >
          <Icon icon={type.icon} className="size-5 shrink-0" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{type.label}</span>
            <span className="text-xs text-muted-foreground">{type.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function ContributionForm({
  type,
  pin,
  onSent,
}: {
  type: ContributionType
  pin: ContributePin | null
  onSent: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fields: {
    file?: true
    caption?: true
    title?: true
    message?: true
  } = type.fields

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  function handleSubmit() {
    if (fields.file && !file) {
      setError("Choose a file first.")
      return
    }
    if (fields.message && !message.trim()) {
      setError("Write a line about it first.")
      return
    }
    if (fields.title && !title.trim()) {
      setError("Give it a name first.")
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        // uploads straight to Blob storage from the browser (bypasses the 4.5mb body limit a
        // server action would hit), then just tells the db the file landed
        const blob = file
          ? await upload(`aui-map/${crypto.randomUUID()}-${file.name}`, file, {
              access: "public",
              handleUploadUrl: "/api/contribute/upload",
              multipart: true,
            })
          : null
        await submitContribution({
          kind: type.kind,
          pinSlug: type.needsPin ? pin?.id : null,
          file:
            blob && file
              ? {
                  url: blob.url,
                  fileName: file.name,
                  mimeType: file.type || null,
                }
              : null,
          caption: caption.trim() || null,
          title: title.trim() || null,
          message: message.trim() || null,
        })
        triggerHaptic("success")
        onSent()
      } catch (err) {
        setError(extractErrorMessage(err, "Couldn't send that — try again."))
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.file &&
        (file ? (
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
        ))}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {fields.title && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.text} htmlFor="contribute-title">
            Name
          </FieldLabel>
          <Input
            id="contribute-title"
            placeholder="Building 8 laundry room"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="corner-squircle"
          />
        </div>
      )}

      {fields.message && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.description} htmlFor="contribute-message">
            Details
          </FieldLabel>
          <Textarea
            id="contribute-message"
            placeholder={
              type.kind === "NEW_PIN"
                ? "Where it is and what it's for."
                : "What's wrong, and what it should say instead."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="corner-squircle"
          />
        </div>
      )}

      {fields.caption && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.caption} htmlFor="contribute-caption">
            Caption
          </FieldLabel>
          <Textarea
            id="contribute-caption"
            placeholder="What it shows, and roughly where it was taken."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            className="corner-squircle"
          />
        </div>
      )}

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
  )
}

// one dialog for every kind of contribution: pick what you're giving, then fill in only the
// fields that kind actually needs. Opened either from the map (nothing preselected) or from a
// pin's detail panel, which passes that pin so the pin-bound kinds have something to attach to
export function ContributeDialog({
  pin = null,
  open,
  onOpenChange,
}: {
  pin?: ContributePin | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [picked, setPicked] = useState<ContributionType | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setPicked(null)
      setSubmitted(false)
    }
  }

  function handleSent() {
    setSubmitted(true)
    setTimeout(() => handleOpenChange(false), SUCCESS_CLOSE_DELAY_MS)
  }

  return (
    <Dialog {...{ open }} onOpenChange={handleOpenChange}>
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
                <Icon icon={picked?.icon ?? ICONS.contributeMenu} />
                {picked?.label ?? "Contribute"}
              </DialogTitle>
              <DialogDescription>
                {picked
                  ? picked.blurb
                  : pin
                    ? `Help fill in ${pin.title}, or flag something else.`
                    : "Everything here gets reviewed before it shows up on the map."}
              </DialogDescription>
            </DialogHeader>

            {picked ? (
              <ContributionForm
                type={picked}
                onSent={handleSent}
                {...{ pin }}
              />
            ) : (
              <ContributionPicker onPick={setPicked} {...{ pin }} />
            )}

            {picked && (
              <button
                type="button"
                onClick={() => setPicked(null)}
                className={cn(
                  "flex items-center justify-center gap-1 text-xs text-muted-foreground",
                  "hover:text-foreground",
                )}
              >
                <Icon icon={ICONS.carouselPrev} className="size-3.5" />
                Something else
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
