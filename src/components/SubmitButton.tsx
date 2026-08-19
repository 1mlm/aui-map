"use client"

import { Loading01Icon } from "@hugeicons/core-free-icons"
import type { ComponentProps, ReactNode } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import { Button } from "@/shadcn/ui/button"
import { cn } from "@/shadcn/utils"

export function SubmitButton({
  icon,
  pending,
  disabled,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  icon: HugeIcon
  pending: boolean
  children: ReactNode
}) {
  return (
    <Button disabled={pending || disabled} className={cn("rounded-full corner-squircle", className)} {...props}>
      <Icon icon={pending ? Loading01Icon : icon} className={pending ? "animate-spin" : undefined} />
      {children}
    </Button>
  )
}
