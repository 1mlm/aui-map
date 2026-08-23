"use client"

import { upload } from "@vercel/blob/client"
import { Reorder } from "motion/react"
import Image from "next/image"
import { type ChangeEvent, useRef, useState, useTransition } from "react"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shadcn/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { Input } from "@/shadcn/ui/input"
import { formatRelativeDate } from "@/utils/date"
import {
  iconForMimeType,
  isImageMimeType,
  isVideoMimeType,
} from "@/utils/mimeType"
import {
  createAttachment,
  deleteAttachment,
  reorderAttachments,
  setAttachmentCaption,
  setThumbnail,
} from "./actions"

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

type PendingUpload = {
  key: string
  file: File
  status: "uploading" | "error"
  progress: number
  message?: string
}

function extractErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
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
      <span className="max-w-full truncate text-[10px]">
        {attachment.fileName ?? "File"}
      </span>
    </a>
  )
}

function AttachmentTile({
  pinId,
  attachment,
  disabled,
  onDelete,
  onSetThumbnail,
  onCaptionSaved,
}: {
  pinId: string
  attachment: AttachmentRow
  disabled: boolean
  onDelete: () => void
  onSetThumbnail: () => void
  onCaptionSaved: (attachments: AttachmentRow[]) => void
}) {
  const [pending, startTransition] = useTransition()
  const [captionDraft, setCaptionDraft] = useState(attachment.caption ?? "")
  const [captionOpen, setCaptionOpen] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)

  function saveCaption() {
    setCaptionError(null)
    startTransition(async () => {
      try {
        onCaptionSaved(
          await setAttachmentCaption(pinId, attachment.id, captionDraft.trim()),
        )
        setCaptionOpen(false)
      } catch (err) {
        setCaptionError(extractErrorMessage(err, "Couldn't save the caption."))
      }
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
          {attachment.isThumbnail && (
            <span className="absolute top-1 left-1 rounded-full corner-squircle bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              Thumbnail
            </span>
          )}
        </Reorder.Item>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={disabled}
          onSelect={() => setCaptionOpen(true)}
        >
          <Icon icon={ICONS.text} />
          Edit caption
        </ContextMenuItem>
        {isImageMimeType(attachment.mimeType) && (
          <ContextMenuItem
            disabled={disabled || attachment.isThumbnail}
            onSelect={onSetThumbnail}
          >
            <Icon icon={ICONS.thumbnail} />
            Set as thumbnail
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          disabled={disabled}
          onSelect={onDelete}
        >
          <Icon icon={ICONS.delete} />
          Delete photo
        </ContextMenuItem>
      </ContextMenuContent>

      <Dialog open={captionOpen} onOpenChange={setCaptionOpen}>
        <DialogContent className="corner-squircle sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon={ICONS.text} />
              Edit caption
            </DialogTitle>
            <DialogDescription className="sr-only">
              Edit the caption shown under this photo
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Posted {formatRelativeDate(attachment.postedAt)}
            </p>
            <Input
              placeholder="Add a caption…"
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              className="corner-squircle"
            />
            <FormError>{captionError}</FormError>
            <Button
              size="sm"
              className="rounded-full corner-squircle"
              disabled={pending}
              onClick={saveCaption}
            >
              <Icon icon={ICONS.save} />
              Save caption
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  )
}

function PendingUploadTile({
  pending,
  onRetry,
  onDismiss,
}: {
  pending: PendingUpload
  onRetry: () => void
  onDismiss: () => void
}) {
  if (pending.status === "uploading") {
    return (
      <div className="relative flex size-20 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl corner-squircle bg-muted text-muted-foreground">
        <Icon icon={ICONS.loading} className="size-5 animate-spin" />
        <span className="text-[10px] font-medium tabular-nums">
          {Math.round(pending.progress)}%
        </span>
      </div>
    )
  }

  return (
    <div className="relative flex size-20 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl corner-squircle bg-destructive/10 p-1 text-center text-destructive">
      <Icon icon={ICONS.notice} className="size-5 shrink-0" />
      <span className="line-clamp-2 text-[9px] leading-tight">
        {pending.message ?? "Upload failed"}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry upload"
          className="rounded-full corner-squircle bg-destructive/10 p-1 hover:bg-destructive/20"
        >
          <Icon icon={ICONS.reopen} className="size-3" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-full corner-squircle bg-destructive/10 p-1 hover:bg-destructive/20"
        >
          <Icon icon={ICONS.clear} className="size-3" />
        </button>
      </div>
    </div>
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
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // uploads go straight from the browser to Blob storage (bypassing the 4.5mb body limit a
  // server action would hit), then this just tells the db the file landed
  async function runUpload(key: string, file: File) {
    try {
      const blob = await upload(
        `aui-map/${crypto.randomUUID()}-${file.name}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/admin/attachments/upload",
          multipart: true,
          onUploadProgress: ({ percentage }) =>
            setPendingUploads((current) =>
              current.map((p) =>
                p.key === key ? { ...p, progress: percentage } : p,
              ),
            ),
        },
      )
      onAttachmentsChange(
        await createAttachment(pinId, {
          url: blob.url,
          fileName: file.name,
          mimeType: file.type || null,
        }),
      )
      setPendingUploads((current) => current.filter((p) => p.key !== key))
    } catch (err) {
      setPendingUploads((current) =>
        current.map((p) =>
          p.key === key
            ? {
                ...p,
                status: "error",
                message: extractErrorMessage(err, "Upload failed."),
              }
            : p,
        ),
      )
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return
    const newPending: PendingUpload[] = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "uploading",
      progress: 0,
    }))
    setPendingUploads((current) => [...current, ...newPending])
    for (const item of newPending) runUpload(item.key, item.file)
  }

  function retryUpload(key: string) {
    const item = pendingUploads.find((p) => p.key === key)
    if (!item) return
    setPendingUploads((current) =>
      current.map((p) =>
        p.key === key
          ? { ...p, status: "uploading", progress: 0, message: undefined }
          : p,
      ),
    )
    runUpload(key, item.file)
  }

  function dismissUpload(key: string) {
    setPendingUploads((current) => current.filter((p) => p.key !== key))
  }

  function handleDelete(attachmentId: string) {
    setActionError(null)
    startTransition(async () => {
      try {
        onAttachmentsChange(await deleteAttachment(pinId, attachmentId))
      } catch (err) {
        setActionError(extractErrorMessage(err, "Couldn't delete that photo."))
      }
    })
  }

  function handleSetThumbnail(attachmentId: string) {
    setActionError(null)
    startTransition(async () => {
      try {
        onAttachmentsChange(await setThumbnail(pinId, attachmentId))
      } catch (err) {
        setActionError(
          extractErrorMessage(err, "Couldn't set that as the thumbnail."),
        )
      }
    })
  }

  // reorders instantly in local state so the drag feels immediate, then persists and
  // reconciles with the canonical (thumbnail-pinned-first) order from the server
  function handleReorder(orderedIds: string[]) {
    const byId = new Map(
      attachments.map((attachment) => [attachment.id, attachment]),
    )
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((a): a is AttachmentRow => Boolean(a))
    onAttachmentsChange(reordered)
    setActionError(null)
    startTransition(async () => {
      try {
        onAttachmentsChange(await reorderAttachments(pinId, orderedIds))
      } catch (err) {
        setActionError(extractErrorMessage(err, "Couldn't save the new order."))
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 overflow-x-auto py-1">
        <Reorder.Group
          as="div"
          axis="x"
          values={attachments.map((attachment) => attachment.id)}
          onReorder={handleReorder}
          className="flex gap-3"
        >
          {attachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              disabled={pending}
              {...{ pinId, attachment }}
              onDelete={() => handleDelete(attachment.id)}
              onSetThumbnail={() => handleSetThumbnail(attachment.id)}
              onCaptionSaved={onAttachmentsChange}
            />
          ))}
        </Reorder.Group>
        {pendingUploads.map((item) => (
          <PendingUploadTile
            key={item.key}
            pending={item}
            onRetry={() => retryUpload(item.key)}
            onDismiss={() => dismissUpload(item.key)}
          />
        ))}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl corner-squircle border border-dashed border-border text-muted-foreground hover:bg-muted"
        >
          <Icon icon={ICONS.upload} />
          <span className="text-xs">Add</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <FormError>{actionError}</FormError>
    </div>
  )
}
