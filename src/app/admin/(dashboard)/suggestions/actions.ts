"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export async function setSuggestionResolved(id: string, resolved: boolean) {
  await requireAuth()
  await prisma.suggestion.update({ where: { id }, data: { resolved } })
  revalidatePath("/admin/suggestions")
}

export async function deleteSuggestion(id: string) {
  await requireAuth()
  await prisma.suggestion.delete({ where: { id } })
  revalidatePath("/admin/suggestions")
}
