"use client"

import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ResponsiveOverlay } from "@/components/ResponsiveOverlay"
import { SubmitButton } from "@/components/SubmitButton"
import { ICONS } from "@/icons"
import { Textarea } from "@/shadcn/ui/textarea"
import { getVisitor } from "@/utils/visitor"
import { submitPinComment } from "./commentActions"

const MAX_LENGTH = 600

// a plain, secondary button on purpose: it's there for whoever wants it, not something to push
export function PinCommentButton({
  pinId,
  pinTitle,
}: {
  pinId: string
  pinTitle: string
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // reset after the close animation so the form doesn't flash back to empty
      setTimeout(() => {
        setSent(false)
        setError(null)
        setMessage("")
      }, 300)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await submitPinComment({
      pinId,
      message,
      website,
      visitorId: getVisitor().id,
    })
    setPending(false)
    if ("error" in result) setError(result.error)
    else setSent(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-full corner-squircle bg-foreground/8 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/15"
      >
        <Icon icon={ICONS.comment} />
        Add a comment
      </button>
      <ResponsiveOverlay
        open={open}
        onOpenChange={handleOpenChange}
        title={sent ? "Thank you!" : `Comment on ${pinTitle}`}
        description={
          sent
            ? "It will be read and the map updated if needed."
            : "Something wrong, missing or out of date? Tell us."
        }
      >
        {sent ? (
          <SubmitButton
            icon={ICONS.check}
            pending={false}
            onClick={() => handleOpenChange(false)}
            className="w-full"
          >
            Done
          </SubmitButton>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_LENGTH}
              rows={4}
              placeholder="e.g. The opening hours changed, there's a new entrance..."
              className="rounded-2xl"
              autoFocus
            />
            {/* honeypot, invisible to people */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="absolute -left-[9999px] size-0 opacity-0"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <SubmitButton
              type="submit"
              icon={ICONS.check}
              pending={pending}
              disabled={message.trim().length < 4}
              className="w-full"
            >
              Send
            </SubmitButton>
          </form>
        )}
      </ResponsiveOverlay>
    </>
  )
}
