"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

// APPROVED = "read it and acted on it", REJECTED = "noise". Neither changes the map by itself,
// the admin edits the pin by hand
export async function reviewComment(formData: FormData): Promise<void> {
  await requireAuth()
  const id = String(formData.get("id") ?? "")
  const status = formData.get("status") === "APPROVED" ? "APPROVED" : "REJECTED"
  if (!id) return
  await prisma.submission.updateMany({
    where: { id, status: "PENDING" },
    data: { status, reviewedAt: new Date() },
  })
  revalidatePath("/admin/comments")
}
