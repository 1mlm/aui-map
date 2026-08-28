"use client"

import { upload } from "@vercel/blob/client"
import {
  type ChangeEvent,
  type ClipboardEvent,
  useRef,
  useState,
  useTransition,
} from "react"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/shadcn/ui/input-group"
import { triggerConfetti } from "@/utils/confetti"
import { extractErrorMessage } from "@/utils/error"
import { iconForMimeType } from "@/utils/mimeType"
import { submitSuggestion } from "./suggestionActions"

const SENT_FEEDBACK_MS = 2000

// either a fresh file picked in this browser (needs uploading on send) or one a share-target
// submission already uploaded server-side (see src/app/share-target/route.ts) — nothing left to
// do with the latter but hand its reference straight to submitSuggestion
type PendingAttachment =
  | { kind: "new"; file: File }
  | { kind: "uploaded"; url: string; fileName: string; mimeType: string | null }

export function SuggestionForm({
  onSent,
  initialMessage,
  initialAttachment,
}: {
  onSent?: () => void
  // seeded from a Web Share Target hand-off (someone shared a link/photo into the installed app)
  initialMessage?: string
  initialAttachment?: { url: string; fileName: string; mimeType: string | null }
}) {
  const [message, setMessage] = useState(initialMessage ?? "")
  const [attachment, setAttachment] = useState<PendingAttachment | null>(
    initialAttachment ? { kind: "uploaded", ...initialAttachment } : null,
  )
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setAttachment(file ? { kind: "new", file } : null)
    event.target.value = ""
  }

  // pasting a screenshot straight in is faster than "save it, then browse for it" — grabs the
  // first image on the clipboard, if any, same as picking one through the file input
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = [...event.clipboardData.items].find((item) =>
      item.type.startsWith("image/"),
    )
    const file = imageItem?.getAsFile()
    if (!file) return
    event.preventDefault()
    setAttachment({ kind: "new", file })
  }

  function attachmentPreview() {
    if (!attachment) return null
    if (attachment.kind === "new")
      return { name: attachment.file.name, mimeType: attachment.file.type }
    return { name: attachment.fileName, mimeType: attachment.mimeType ?? "" }
  }

  function handleSend() {
    if (!message.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        // uploads straight to Blob storage from the browser (bypasses the 4.5mb body limit a
        // server action would hit), then just tells the db the file landed. An already-uploaded
        // (share-target) attachment skips this — it's already sitting in Blob storage
        const blob =
          attachment?.kind === "new"
            ? await upload(
                `aui-map/${crypto.randomUUID()}-${attachment.file.name}`,
                attachment.file,
                {
                  access: "public",
                  handleUploadUrl: "/api/contribute/upload",
                  multipart: true,
                },
              )
            : null
        const blobInfo =
          attachment?.kind === "uploaded"
            ? {
                url: attachment.url,
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
              }
            : blob && attachment?.kind === "new"
              ? {
                  url: blob.url,
                  fileName: attachment.file.name,
                  mimeType: attachment.file.type || null,
                }
              : null
        const result = await submitSuggestion(message, blobInfo)
        if (result?.error) {
          setError(result.error)
          return
        }
        setMessage("")
        setAttachment(null)
        setSent(true)
        triggerConfetti()
        setTimeout(() => {
          setSent(false)
          onSent?.()
        }, SENT_FEEDBACK_MS)
      } catch (err) {
        setError(extractErrorMessage(err, "Couldn't send that — try again."))
      }
    })
  }

  const preview = attachmentPreview()

  return (
    <div className="flex w-72 flex-col gap-2">
      <InputGroup className="corner-squircle">
        <InputGroupTextarea
          placeholder="Report a bug or suggest something…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          enterKeyHint="send"
          rows={3}
        />
        {preview && (
          <InputGroupAddon align="block-start" className="border-b">
            <span className="flex w-full items-center gap-1.5 text-xs text-muted-foreground">
              <Icon
                icon={iconForMimeType(preview.mimeType)}
                className="shrink-0"
              />
              <span className="truncate">{preview.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove file"
                className="ml-auto shrink-0 rounded-full corner-squircle p-0.5 hover:bg-foreground/10"
              >
                <Icon icon={ICONS.clear} className="size-3" />
              </button>
            </span>
          </InputGroupAddon>
        )}
        <InputGroupAddon align="block-end">
          <InputGroupButton
            size="icon-sm"
            variant="ghost"
            className="rounded-full corner-squircle"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a file"
          >
            <Icon icon={ICONS.add} />
          </InputGroupButton>
          <InputGroupButton
            size="icon-sm"
            variant="default"
            className="ml-auto rounded-full corner-squircle"
            disabled={pending || !message.trim()}
            onClick={handleSend}
            aria-label="Send"
          >
            <Icon icon={sent ? ICONS.success : ICONS.send} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <FormError>{error}</FormError>
    </div>
  )
}
