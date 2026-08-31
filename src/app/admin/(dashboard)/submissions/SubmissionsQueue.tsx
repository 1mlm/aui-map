"use client"

import Image from "next/image"
import { useTransition } from "react"
import { Icon } from "@/components/Icon"
import { DateCell } from "@/components/table/CustomTableCell"
import type { SubmissionKind } from "@/generated/prisma/client"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { iconForMimeType, isImageMimeType } from "@/utils/mimeType"
import { approveSubmission, rejectSubmission } from "./actions"

export type PendingSubmission = {
  id: string
  kind: SubmissionKind
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
  caption: string | null
  message: string | null
  title: string | null
  latitude: number | null
  longitude: number | null
  pinId: string | null
  pinTitle: string | null
  submittedAt: string
}

const KIND_LABEL: Record<SubmissionKind, string> = {
  ATTACHMENT: "New file",
  PANORAMA: "Panorama",
  NEW_PIN: "New place",
  PIN_EDIT: "Correction",
}

function SubmissionPreview({ submission }: { submission: PendingSubmission }) {
  if (!submission.fileUrl || !submission.mimeType) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted p-3 text-muted-foreground">
        <Icon icon={ICONS.suggestions} className="size-8" />
        <span className="text-center text-xs">
          {submission.title ?? "No file — read the note below"}
        </span>
      </div>
    )
  }

  if (isImageMimeType(submission.mimeType)) {
    return (
      <div className="relative aspect-video bg-muted">
        <Image src={submission.fileUrl} alt="" fill sizes="320px" className="object-cover" />
      </div>
    )
  }
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
      <Icon icon={iconForMimeType(submission.mimeType)} className="size-8" />
      <span className="max-w-[80%] truncate text-xs">{submission.fileName}</span>
    </div>
  )
}

function SubmissionCard({ submission }: { submission: PendingSubmission }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg corner-squircle border border-border">
      <SubmissionPreview {...{ submission }} />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {submission.pinTitle ?? submission.title ?? "Unplaced"}
          </span>
          <span className="text-xs text-muted-foreground">
            <DateCell date={new Date(submission.submittedAt)} />
          </span>
        </div>
        <span className="w-fit rounded-full corner-squircle bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground">
          {KIND_LABEL[submission.kind]}
        </span>
        {submission.message && <p className="text-xs">{submission.message}</p>}
        {submission.caption && <p className="text-xs text-muted-foreground">{submission.caption}</p>}
        {submission.latitude !== null && submission.longitude !== null && (
          <p className="font-mono text-[0.65rem] text-muted-foreground">
            {submission.latitude}, {submission.longitude}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => startTransition(() => approveSubmission(submission.id))}
          >
            <Icon icon={ICONS.check} />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => startTransition(() => rejectSubmission(submission.id))}
          >
            <Icon icon={ICONS.close} />
            Reject
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SubmissionsQueue({ submissions }: { submissions: PendingSubmission[] }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg corner-squircle border border-dashed border-border p-16 text-muted-foreground">
          <Icon icon={ICONS.photos} className="size-8" />
          <span className="text-sm">No submissions waiting for review.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {submissions.map((submission) => (
            <SubmissionCard key={submission.id} {...{ submission }} />
          ))}
        </div>
      )}
    </div>
  )
}
