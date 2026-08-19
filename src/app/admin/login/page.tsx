"use client"

import { Key01Icon, SquareUnlock01Icon } from "@hugeicons/core-free-icons"
import { useActionState, useEffect, useRef, useState } from "react"
import { DelayedButton } from "@/components/DelayedButton"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shadcn/ui/input-group"
import { unlockWithCode } from "./actions"

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(unlockWithCode, { error: false })

  // every failed attempt re-arms the delay, so brute-forcing the code stays
  // throttled to one guess per wait window instead of only the first try
  const [attempt, setAttempt] = useState(0)
  const previousState = useRef(state)
  useEffect(() => {
    if (previousState.current !== state) {
      previousState.current = state
      setAttempt((n) => n + 1)
    }
  }, [state])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <form action={formAction} className="flex w-full max-w-64 flex-col gap-2">
        <InputGroup>
          <InputGroupAddon>
            <Icon icon={Key01Icon} />
          </InputGroupAddon>
          <InputGroupInput
            name="code"
            type="password"
            placeholder="Secret code"
            autoFocus
            aria-invalid={state.error}
          />
        </InputGroup>
        <DelayedButton
          key={attempt}
          type="submit"
          className="rounded-full corner-squircle"
          waitingLabel="Please wait…"
          {...{ pending }}
          waitSeconds={attempt === 0 ? 0 : 7}
        >
          <Icon icon={SquareUnlock01Icon} />
          Unlock
        </DelayedButton>
        {state.error && <FormError className="justify-center">Incorrect code</FormError>}
      </form>
    </div>
  )
}
