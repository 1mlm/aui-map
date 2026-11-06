"use client"

import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { AttachmentManager, type AttachmentRow } from "./AttachmentManager"

// a focused popup for just the photo gallery, reachable straight from the pins table —
// opening the full PinDialog would be overkill when all you want is to reorder or delete photos
export function PinPhotosDialog({
  pinId,
  pinTitle,
  attachments,
  origin,
  open,
  onOpenChange,
}: {
  pinId: string
  pinTitle: string
  attachments: AttachmentRow[]
  origin: { latitude: number; longitude: number }
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
            Drag to reorder. Right-click a photo for the thumbnail, its caption
            and where it was taken.
          </DialogDescription>
        </DialogHeader>
        <AttachmentManager
          {...{ pinId, origin }}
          attachments={rows}
          onAttachmentsChange={setRows}
        />
      </DialogContent>
    </Dialog>
  )
}
