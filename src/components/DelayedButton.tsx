"use client"

import { Loading01Icon } from "@hugeicons/core-free-icons"
import { useEffect, useState } from "react"
import type { ComponentProps } from "react"
import { Icon } from "@/components/Icon"
import { Button } from "@/shadcn/ui/button"

// forces a fixed wait before an action can run at all — a cheap, deliberate
// friction against reflexive misclicks (destructive confirms) and rapid-fire
// brute forcing (gate unlock), without exposing a countdown to race against
export function DelayedButton({
  waitSeconds = 7,
  disabled,
  // true while the click's own async work (the actual request) is in flight,
  // distinct from `ready` — the artificial wait before the button can be
  // clicked at all. Both states render the same spinner, they just guard
  // different moments
  pending,
  waitingLabel = "Please wait…",
  children,
  ...props
}: ComponentProps<typeof Button> & {
  waitSeconds?: number
  pending?: boolean
  waitingLabel?: string
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), waitSeconds * 1000)
    return () => clearTimeout(timeout)
  }, [waitSeconds])

  return (
    <Button disabled={!ready || pending || disabled} {...props}>
      {ready && !pending ? (
        children
      ) : (
        <>
          <Icon icon={Loading01Icon} className="animate-spin" />
          {waitingLabel}
        </>
      )}
    </Button>
  )
}
