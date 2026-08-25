"use client"

import { upload } from "@vercel/blob/client"
import { type ChangeEvent, useRef, useState, useTransition } from "react"
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

export function SuggestionForm({ onSent }: { onSent?: () => void }) {
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
    event.target.value = ""
  }

  function handleSend() {
    if (!message.trim()) return
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
        const result = await submitSuggestion(
          message,
          blob && file
            ? {
                url: blob.url,
                fileName: file.name,
                mimeType: file.type || null,
              }
            : null,
        )
        if (result?.error) {
          setError(result.error)
          return
        }
        setMessage("")
        setFile(null)
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

  return (
    <div className="flex w-72 flex-col gap-2">
      <InputGroup className="corner-squircle">
        <InputGroupTextarea
          placeholder="Report a bug or suggest something…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        {file && (
          <InputGroupAddon align="block-start" className="border-b">
            <span className="flex w-full items-center gap-1.5 text-xs text-muted-foreground">
              <Icon icon={iconForMimeType(file.type)} className="shrink-0" />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
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
