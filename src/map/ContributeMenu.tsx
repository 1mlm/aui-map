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
import { Input } from "@/shadcn/ui/input"
import { Textarea } from "@/shadcn/ui/textarea"
import { extractErrorMessage } from "@/utils/error"
import { triggerHaptic } from "@/utils/haptics"
import {
  iconForMimeType,
  isImageMimeType,
  isVideoMimeType,
} from "@/utils/mimeType"
import { submitContribution } from "./contributeActions"
import { MiniMapPicker, type Placement } from "./MiniMapPicker"
import { submitSuggestion } from "./suggestionActions"

const SUCCESS_CLOSE_DELAY_MS = 1600

type FieldName =
  | "file"
  | "caption"
  | "title"
  | "message"
  | "coord"
  | "description"

// one row per thing someone can give. Everything downstream — the cards, which fields the form
// shows, what's required before Send lights up, which action it posts to — reads off this, so a
// seventh kind is an entry here rather than a seventh bespoke form
const CONTRIBUTION_TYPES = [
  {
    id: "attachment",
    icon: ICONS.photos,
    label: "A photo or file",
    blurb: "A picture, a menu, a floor plan — anything useful about a place.",
    needsPin: true,
    fields: ["file", "caption"],
    required: ["file"],
  },
  {
    id: "panorama",
    icon: ICONS.contributePanorama,
    label: "A panorama",
    blurb: "A wide shot of campus. It goes on the map itself, not on a pin.",
    needsPin: false,
    fields: ["file", "coord", "caption"],
    required: ["file"],
  },
  {
    id: "newPin",
    icon: ICONS.contributeNewPin,
    label: "A missing place",
    blurb: "Something that should be on the map but isn't yet.",
    needsPin: false,
    fields: ["title", "coord", "description"],
    required: ["title"],
  },
  {
    id: "pinEdit",
    icon: ICONS.contributeEdit,
    label: "Fix missing or wrong info on a place",
    blurb: "Wrong name, wrong spot, outdated hours — tell me what's off.",
    needsPin: true,
    fields: ["message"],
    required: ["message"],
  },
  {
    id: "bug",
    icon: ICONS.bug,
    label: "Report a bug",
    blurb: "Something in the app itself is broken or acting weird.",
    needsPin: false,
    fields: ["message"],
    required: ["message"],
  },
  {
    id: "feature",
    icon: ICONS.suggestions,
    label: "Suggest a feature",
    blurb: "Something you wish the map could do.",
    needsPin: false,
    fields: ["message"],
    required: ["message"],
  },
] as const satisfies readonly {
  id: string
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  blurb: string
  needsPin: boolean
  fields: readonly FieldName[]
  required: readonly FieldName[]
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
        className="max-h-32 w-full rounded-xl corner-squircle object-cover"
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
        className="max-h-32 w-full rounded-xl corner-squircle"
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
  const [coord, setCoord] = useState<Placement | null>(null)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fields: readonly FieldName[] = type.fields
  const filled: Record<FieldName, boolean> = {
    file: file !== null,
    caption: caption.trim().length > 0,
    title: title.trim().length > 0,
    message: message.trim().length > 0,
    description: message.trim().length > 0,
    coord: coord !== null,
  }
  // Send stays inert until the one or two things I actually can't fill in myself are there
  const canSend = type.required.every((field) => filled[field])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        if (type.id === "bug" || type.id === "feature") {
          const result = await submitSuggestion(
            type.id === "bug" ? "BUG" : "FEATURE",
            message.trim(),
            null,
          )
          if (result?.error) {
            setError(result.error)
            return
          }
        } else {
          // uploads straight to Blob storage from the browser (bypasses the 4.5mb body limit a
          // server action would hit), then just tells the db the file landed
          const blob = file
            ? await upload(
                `aui-map/${crypto.randomUUID()}-${file.name}`,
                file,
                {
                  access: "public",
                  handleUploadUrl: "/api/contribute/upload",
                  multipart: true,
                },
              )
            : null
          await submitContribution({
            kind:
              type.id === "attachment"
                ? "ATTACHMENT"
                : type.id === "panorama"
                  ? "PANORAMA"
                  : type.id === "newPin"
                    ? "NEW_PIN"
                    : "PIN_EDIT",
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
            coord,
          })
        }
        triggerHaptic("success")
        onSent()
      } catch (err) {
        setError(extractErrorMessage(err, "Couldn't send that — try again."))
      }
    })
  }

  const coordField = fields.includes("coord") && (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={ICONS.place}>
        {coord ? "Where it is" : "Where is it? (optional)"}
      </FieldLabel>
      <MiniMapPicker value={coord} onPick={setCoord} />
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {fields.includes("file") &&
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

      {fields.includes("title") && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.text} htmlFor="contribute-title">
            Name
          </FieldLabel>
          <Input
            id="contribute-title"
            placeholder="Building 8 laundry room"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="corner-squircle"
          />
        </div>
      )}

      {fields.includes("message") && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.description} htmlFor="contribute-message">
            Details
          </FieldLabel>
          <Textarea
            id="contribute-message"
            placeholder={
              type.id === "bug"
                ? "What you did, and what happened instead."
                : type.id === "feature"
                  ? "What you'd want it to do."
                  : "What's wrong, and what it should say instead."
            }
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="corner-squircle"
          />
        </div>
      )}

      {/* a missing place only really needs its name from you — everything else is me doing my
          job, so the rest is folded away rather than sitting there looking mandatory */}
      {fields.includes("description") ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Only the name really matters. Write whatever you want for the rest,
            I'll clean it up myself.
          </p>
          <button
            type="button"
            onClick={() => setExtrasOpen((open) => !open)}
            className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Icon
              icon={ICONS.dropdown}
              className={extrasOpen ? "size-3.5" : "size-3.5 -rotate-90"}
            />
            {extrasOpen ? "Hide extra details" : "Add extra details"}
          </button>
          {extrasOpen && (
            <div className="flex flex-col gap-3">
              {coordField}
              <div className="flex flex-col gap-1.5">
                <FieldLabel
                  icon={ICONS.description}
                  htmlFor="contribute-description"
                >
                  Anything else
                </FieldLabel>
                <Textarea
                  id="contribute-description"
                  placeholder="What it's for, opening hours, which building it's in…"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  className="corner-squircle"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        coordField
      )}

      {fields.includes("caption") && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.caption} htmlFor="contribute-caption">
            Caption
          </FieldLabel>
          <Textarea
            id="contribute-caption"
            placeholder="What it shows, and roughly where it was taken."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={2}
            className="corner-squircle"
          />
        </div>
      )}

      <FormError>{error}</FormError>
      <Button
        className="w-full rounded-full corner-squircle"
        disabled={pending || !canSend}
        onClick={handleSubmit}
      >
        <Icon icon={ICONS.send} />
        {pending ? "Sending…" : "Send"}
      </Button>
    </div>
  )
}

// the body of the contribute popover: pick what you're giving, then fill in only what that kind
// needs. Rendered from the map (nothing preselected) and from a pin's panel, which passes that
// pin so the two pin-bound kinds have something to attach to
export function ContributeMenu({
  pin = null,
  onClose,
}: {
  pin?: ContributePin | null
  onClose: () => void
}) {
  const [picked, setPicked] = useState<ContributionType | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (submitted)
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Icon icon={ICONS.success} className="size-8 text-green-500" />
        <p className="text-sm font-medium">Thanks! Sent for review.</p>
      </div>
    )

  // the two pin-bound kinds are only answerable about a place you already have open, so from the
  // map's own button they'd be a dead end asking "which pin?" with no way to say
  const offered = CONTRIBUTION_TYPES.filter((type) => pin || !type.needsPin)

  if (!picked)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon icon={ICONS.contributeMenu} />
            Contribute
          </span>
          <span className="text-xs text-muted-foreground">
            {pin
              ? `Help fill in ${pin.title}, or flag something else.`
              : "I read everything before it goes on the map."}
          </span>
        </div>
        {offered.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => {
              triggerHaptic()
              setPicked(type)
            }}
            className="flex cursor-pointer items-center gap-3 rounded-xl corner-squircle border border-border p-2.5 text-left transition-colors hover:bg-muted"
          >
            <Icon icon={type.icon} className="size-5 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{type.label}</span>
              <span className="text-xs text-muted-foreground">
                {type.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon icon={picked.icon} />
          {picked.label}
        </span>
        <span className="text-xs text-muted-foreground">{picked.blurb}</span>
      </div>

      <ContributionForm
        type={picked}
        onSent={() => {
          setSubmitted(true)
          setTimeout(onClose, SUCCESS_CLOSE_DELAY_MS)
        }}
        {...{ pin }}
      />

      <button
        type="button"
        onClick={() => setPicked(null)}
        className="flex cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Icon icon={ICONS.carouselPrev} className="size-3.5" />
        Something else
      </button>
    </div>
  )
}
