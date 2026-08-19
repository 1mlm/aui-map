import type { ComponentProps } from "react"
import type { HugeIcon } from "@/components/Icon"
import { Icon } from "@/components/Icon"
import { Label } from "@/shadcn/ui/label"
import { cn } from "@/shadcn/utils"

export function FieldLabel({
  icon,
  className,
  children,
  ...props
}: { icon: HugeIcon } & ComponentProps<typeof Label>) {
  return (
    <Label className={cn("gap-1.5 text-xs text-muted-foreground", className)} {...props}>
      <Icon {...{ icon }} />
      {children}
    </Label>
  )
}
