"use client"

import type { ReactNode } from "react"
import type { HugeIcon } from "@/components/Icon"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shadcn/ui/dialog"
import { cn } from "@/shadcn/utils"
import { FormError } from "./FormError"
import { SubmitButton } from "./SubmitButton"

// the Dialog/form/FormError/SubmitButton shell every admin add/edit dialog repeats —
// callers only differ in title, submit icon/label, size, and the fields themselves
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  pending,
  error,
  submitIcon,
  submitLabel,
  secondaryAction,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: string
  onSubmit: () => void
  pending: boolean
  error: string | null
  submitIcon: HugeIcon
  submitLabel: ReactNode
  secondaryAction?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Dialog {...{ open, onOpenChange }}>
      {/* capped at viewport height with the field list scrolling on its own — otherwise a dialog
          with enough fields (this one included) grows past the viewport with no way to reach
          the footer at all */}
      <DialogContent className={cn("corner-squircle flex max-h-[85vh] flex-col sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto">
          {children}
          <FormError>{error}</FormError>
        </div>
        <DialogFooter className={secondaryAction ? "sm:justify-between" : undefined}>
          {secondaryAction}
          <SubmitButton icon={submitIcon} {...{ pending }} onClick={onSubmit}>
            {submitLabel}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
