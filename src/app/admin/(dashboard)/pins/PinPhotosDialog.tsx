"use client"

import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shadcn/ui/dialog"
import { AttachmentManager, type AttachmentRow } from "./AttachmentManager"

// a focused popup for just the photo gallery, reachable straight from the pins table —
// opening the full PinDialog would be overkill when all you want is to reorder or delete photos
export function PinPhotosDialog({
  pinId,
  pinTitle,
  attachments,
  open,
  onOpenChange,
}: {
  pinId: string
  pinTitle: string
  attachments: AttachmentRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [rows, setRows] = useState(attachments)

  return (
    <Dialog {...{ open, onOpenChange }}>
      <DialogContent className="corner-squircle sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={ICONS.photo} />
            {pinTitle}
          </DialogTitle>
          <DialogDescription>
            Drag to reorder, right-click a photo to set it as the thumbnail.
          </DialogDescription>
        </DialogHeader>
        <AttachmentManager pinId={pinId} attachments={rows} onAttachmentsChange={setRows} />
      </DialogContent>
    </Dialog>
  )
}
