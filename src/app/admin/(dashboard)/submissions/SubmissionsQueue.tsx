"use client"

import Image from "next/image"
import { useTransition } from "react"
import { Icon } from "@/components/Icon"
import { DateCell } from "@/components/table/CustomTableCell"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { iconForMimeType, isImageMimeType } from "@/utils/mimeType"
import { approveSubmission, rejectSubmission } from "./actions"

export type PendingSubmission = {
  id: string
  fileUrl: string
  fileName: string
  mimeType: string
  caption: string | null
  pinId: string
  pinTitle: string
  submittedAt: string
}

function SubmissionPreview({ submission }: { submission: PendingSubmission }) {
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
          <span className="text-sm font-medium">{submission.pinTitle}</span>
          <span className="text-xs text-muted-foreground">
            <DateCell date={new Date(submission.submittedAt)} />
          </span>
        </div>
        {submission.caption && <p className="text-xs text-muted-foreground">{submission.caption}</p>}
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
