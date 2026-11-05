import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/utils/prisma"
import { reviewComment } from "./actions"

export const metadata: Metadata = { title: "Comments" }
export const dynamic = "force-dynamic"

export default async function AdminCommentsPage() {
  const comments = await prisma.submission.findMany({
    where: { kind: "PIN_EDIT", status: "PENDING" },
    include: { pin: { select: { id: true, title: true } } },
    orderBy: { submittedAt: "desc" },
    take: 200,
  })

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="font-semibold text-xl">Comments</h1>
        <p className="text-muted-foreground text-sm">
          What visitors wrote on a pin. Fix the pin if needed, then mark it
          done.
        </p>
      </div>
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing waiting.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="space-y-2 rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <Link
                  href={`/${comment.pin?.id ?? ""}`}
                  target="_blank"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {comment.pin?.title ?? "Deleted pin"}
                </Link>
                <span className="text-muted-foreground">
                  {comment.submittedAt
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{comment.message}</p>
              <div className="flex gap-3 text-sm">
                {(["APPROVED", "REJECTED"] as const).map((status) => (
                  <form key={status} action={reviewComment}>
                    <input type="hidden" name="id" value={comment.id} />
                    <input type="hidden" name="status" value={status} />
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {status === "APPROVED" ? "Done" : "Dismiss"}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
