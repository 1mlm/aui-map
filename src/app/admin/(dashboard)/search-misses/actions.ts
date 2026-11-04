"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

// dismiss a query once it's handled (pin added, alias added) or is just noise
export async function dismissSearchMiss(formData: FormData): Promise<void> {
  await requireAuth()
  const query = String(formData.get("query") ?? "")
  if (!query) return
  await prisma.searchMiss.deleteMany({ where: { query } })
  revalidatePath("/admin/search-misses")
}
