"use client"

import { useState, useTransition } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/shadcn/ui/input-group"
import { submitSuggestion } from "./suggestionActions"

const SENT_FEEDBACK_MS = 2000

export function SuggestionForm() {
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!message.trim()) return
    startTransition(async () => {
      await submitSuggestion(message)
      setMessage("")
      setSent(true)
      setTimeout(() => setSent(false), SENT_FEEDBACK_MS)
    })
  }

  return (
    <div className="w-72">
      <InputGroup className="corner-squircle">
        <InputGroupTextarea
          placeholder="Report a bug or suggest something…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <InputGroupAddon align="block-end">
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
    </div>
  )
}
