"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/shadcn/ui/sheet"
import { triggerHaptic } from "@/utils/haptics"
import type { AppNavBrand, SheetFooterRenderer } from "./types"

export function MoreSheet({
  brand,
  sheetTitle,
  sheetDescription,
  sheetFooter,
}: {
  brand: AppNavBrand
  sheetTitle: string
  sheetDescription: string
  sheetFooter: SheetFooterRenderer
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet {...{ open, onOpenChange: setOpen }}>
      <SheetTrigger asChild>
        <button
          type="button"
          onClick={() => triggerHaptic("light")}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground"
        >
          <Icon icon={MoreHorizontalIcon} className="size-5" />
          <span className="text-[0.65rem]">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-3 p-4" showCloseButton={false}>
        <SheetHeader className="sr-only p-0">
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col items-center gap-1 pb-1">
          <Image src={brand.iconSrc} alt={brand.text} width={32} height={32} className="size-8" />
          <span className="font-semibold">{brand.text}</span>
          {brand.subtext && <span className="text-xs text-muted-foreground">{brand.subtext}</span>}
        </div>
        {sheetFooter({ open, close: () => setOpen(false) })}
      </SheetContent>
    </Sheet>
  )
}
