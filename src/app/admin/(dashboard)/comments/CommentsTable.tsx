"use client"

import { Suspense, useState, useTransition } from "react"
import { Icon } from "@/components/Icon"
import { SearchBar } from "@/components/SearchBar"
import {
  CustomTable,
  type CustomTableColumn,
} from "@/components/table/CustomTable"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { reviewComment } from "./actions"

export type AdminComment = {
  id: string
  pinId: string | null
  pinTitle: string
  message: string
  sentAt: string
}

function ReviewButton({
  id,
  status,
  onDone,
}: {
  id: string
  status: "APPROVED" | "REJECTED"
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const approve = status === "APPROVED"
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      title={approve ? "Done: I acted on it" : "Dismiss: not useful"}
      aria-label={approve ? "Mark as done" : "Dismiss"}
      className={
        approve
          ? "rounded-full corner-squircle text-muted-foreground hover:bg-green-500/15 hover:text-green-600"
          : "rounded-full corner-squircle text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
      }
      onClick={() =>
        startTransition(async () => {
          const form = new FormData()
          form.set("id", id)
          form.set("status", status)
          await reviewComment(form)
          onDone()
        })
      }
    >
      <Icon
        icon={pending ? ICONS.loading : approve ? ICONS.check : ICONS.close}
        className={pending ? "animate-spin" : undefined}
      />
    </Button>
  )
}

function CommentsTableInner({ comments }: { comments: AdminComment[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set())
  const items = comments.filter((comment) => !gone.has(comment.id))
  const [resultCount, setResultCount] = useState(items.length)

  const columns: CustomTableColumn<AdminComment>[] = [
    {
      id: "pin",
      label: "Place",
      icon: ICONS.place,
      type: "string",
      getString: (comment) => comment.pinTitle,
      onClick: (comment) =>
        comment.pinId && window.open(`/${comment.pinId}`, "_blank"),
    },
    {
      id: "message",
      label: "Comment",
      icon: ICONS.comment,
      type: "string",
      getString: (comment) => comment.message,
    },
    {
      id: "sentAt",
      label: "Sent",
      icon: ICONS.clock,
      type: "date",
      getDate: (comment) => new Date(comment.sentAt),
    },
    {
      id: "actions",
      label: "",
      icon: ICONS.check,
      type: "buttons",
      getButtons: (comment) => {
        const hide = () =>
          setGone((current) => new Set(current).add(comment.id))
        return (
          <div className="flex items-center justify-end gap-1">
            <ReviewButton id={comment.id} status="APPROVED" onDone={hide} />
            <ReviewButton id={comment.id} status="REJECTED" onDone={hide} />
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <SearchBar
        className="flex-1"
        placeholder="Search comments..."
        trailing={`${resultCount} ${resultCount === 1 ? "comment" : "comments"}`}
      />
      <CustomTable
        {...{ columns, items }}
        getItemId={(comment) => comment.id}
        emptyLabel="comments"
        exportFilePrefix="comments"
        paginate={false}
        onVisibleCountChange={setResultCount}
      />
    </div>
  )
}

export function CommentsTable(props: { comments: AdminComment[] }) {
  return (
    <Suspense>
      <CommentsTableInner {...props} />
    </Suspense>
  )
}
