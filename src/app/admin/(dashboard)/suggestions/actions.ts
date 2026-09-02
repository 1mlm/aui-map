"use server"

import { revalidatePath } from "next/cache"
import { deleteFile } from "@/utils/cloudinary"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export async function setSuggestionResolved(id: string, resolved: boolean) {
  await requireAuth()
  await prisma.suggestion.update({ where: { id }, data: { resolved } })
  revalidatePath("/admin/suggestions")
}

export async function deleteSuggestion(id: string) {
  await requireAuth()
  const suggestion = await prisma.suggestion.delete({ where: { id } })
  if (suggestion.fileUrl) await deleteFile(suggestion.fileUrl)
  revalidatePath("/admin/suggestions")
}
