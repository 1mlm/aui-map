"use client"

import { Reorder } from "motion/react"
import Image from "next/image"
import { type ChangeEvent, useRef, useState, useTransition } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/shadcn/ui/context-menu"
import { Input } from "@/shadcn/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { formatRelativeDate } from "@/utils/date"
import { iconForMimeType, isImageMimeType, isVideoMimeType } from "@/utils/mimeType"
import { deleteAttachment, reorderAttachments, setAttachmentCaption, setThumbnail, uploadAttachment } from "./actions"

export type AttachmentRow = {
  id: string
  url: string
  caption: string | null
  mimeType: string | null
  fileName: string | null
  isThumbnail: boolean
  order: number
  postedAt: string
}

function AttachmentThumbnail({ attachment }: { attachment: AttachmentRow }) {
  if (isImageMimeType(attachment.mimeType)) {
    return (
      <Image
        src={attachment.url}
        alt={attachment.caption ?? ""}
        fill
        sizes="80px"
        draggable={false}
        className="pointer-events-none object-cover"
      />
    )
  }

  if (isVideoMimeType(attachment.mimeType)) {
    // muted + preload="metadata" renders the first frame as a free thumbnail, no transcoding needed
    return (
      <video
        src={attachment.url}
        muted
        playsInline
        preload="metadata"
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-muted-foreground"
    >
      <Icon icon={iconForMimeType(attachment.mimeType)} className="size-6" />
      <span className="max-w-full truncate text-[10px]">{attachment.fileName ?? "File"}</span>
    </a>
  )
}

function AttachmentTile({
  pinId,
  attachment,
  disabled,
  onAttachmentsChange,
}: {
  pinId: string
  attachment: AttachmentRow
  disabled: boolean
  onAttachmentsChange: (attachments: AttachmentRow[]) => void
}) {
  const [pending, startTransition] = useTransition()
  const [captionDraft, setCaptionDraft] = useState(attachment.caption ?? "")
  const [captionOpen, setCaptionOpen] = useState(false)

  function saveCaption() {
    startTransition(async () => {
      onAttachmentsChange(await setAttachmentCaption(pinId, attachment.id, captionDraft.trim()))
      setCaptionOpen(false)
    })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Reorder.Item
          value={attachment.id}
          className="group relative size-20 shrink-0 cursor-grab overflow-hidden rounded-xl corner-squircle bg-muted active:cursor-grabbing"
        >
          <AttachmentThumbnail {...{ attachment }} />
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Popover open={captionOpen} onOpenChange={setCaptionOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-7 rounded-full corner-squircle"
                  disabled={disabled}
                  aria-label="Edit caption"
                >
                  <Icon icon={ICONS.text} className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="flex w-56 flex-col gap-2 corner-squircle">
                <p className="text-xs text-muted-foreground">Posted {formatRelativeDate(attachment.postedAt)}</p>
                <Input
                  placeholder="Add a caption…"
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  className="corner-squircle"
                />
                <Button size="sm" className="rounded-full corner-squircle" disabled={pending} onClick={saveCaption}>
                  <Icon icon={ICONS.save} />
                  Save caption
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="size-7 rounded-full corner-squircle"
              disabled={disabled}
              onClick={() =>
                startTransition(async () => onAttachmentsChange(await deleteAttachment(pinId, attachment.id)))
              }
              aria-label="Delete photo"
            >
              <Icon icon={ICONS.delete} className="size-3.5" />
            </Button>
          </div>
          {attachment.isThumbnail && (
            <span className="absolute top-1 left-1 rounded-full corner-squircle bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              Thumbnail
            </span>
          )}
        </Reorder.Item>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isImageMimeType(attachment.mimeType) && (
          <ContextMenuItem
            disabled={disabled || attachment.isThumbnail}
            onSelect={() => startTransition(async () => onAttachmentsChange(await setThumbnail(pinId, attachment.id)))}
          >
            <Icon icon={ICONS.thumbnail} />
            Set as thumbnail
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

// shared by both the pin edit dialog and the pins table's Photos popup — one place that owns
// upload/delete/caption/reorder/thumbnail so those two surfaces can't drift apart
export function AttachmentManager({
  pinId,
  attachments,
  onAttachmentsChange,
}: {
  pinId: string
  attachments: AttachmentRow[]
  onAttachmentsChange: (attachments: AttachmentRow[]) => void
}) {
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const formData = new FormData()
    formData.set("file", file)
    setUploading(true)
    startTransition(async () => {
      try {
        onAttachmentsChange(await uploadAttachment(pinId, formData))
      } finally {
        setUploading(false)
      }
    })
  }

  // reorders instantly in local state so the drag feels immediate, then persists and
  // reconciles with the canonical (thumbnail-pinned-first) order from the server
  function handleReorder(orderedIds: string[]) {
    const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]))
    const reordered = orderedIds.map((id) => byId.get(id)).filter((a): a is AttachmentRow => Boolean(a))
    onAttachmentsChange(reordered)
    startTransition(async () => onAttachmentsChange(await reorderAttachments(pinId, orderedIds)))
  }

  return (
    <div className="flex items-center gap-3 overflow-x-auto py-1">
      <Reorder.Group
        as="div"
        axis="x"
        values={attachments.map((attachment) => attachment.id)}
        onReorder={handleReorder}
        className="flex gap-3"
      >
        {attachments.map((attachment) => (
          <AttachmentTile key={attachment.id} disabled={pending} {...{ pinId, attachment, onAttachmentsChange }} />
        ))}
      </Reorder.Group>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl corner-squircle border border-dashed border-border text-muted-foreground hover:bg-muted"
      >
        <Icon icon={uploading ? ICONS.loading : ICONS.upload} className={uploading ? "animate-spin" : undefined} />
        <span className="text-xs">{uploading ? "Uploading…" : "Add"}</span>
      </button>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
