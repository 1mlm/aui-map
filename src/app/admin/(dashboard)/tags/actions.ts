"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export type TagInput = {
  id: string
  label: string
  icon: string
  color: string | null
  sizeScale: number
}

export async function upsertTag(input: TagInput) {
  await requireAuth()
  const shared = {
    label: input.label,
    icon: input.icon,
    color: input.color,
    sizeScale: input.sizeScale,
  }
  await prisma.tag.upsert({
    where: { id: input.id },
    create: { id: input.id, ...shared },
    update: shared,
  })
  revalidatePath("/")
  revalidatePath("/admin/tags")
  revalidatePath(`/admin/tags/${input.id}`)
}

export async function deleteTag(id: string) {
  await requireAuth()
  const pinCount = await prisma.pin.count({ where: { tagId: id } })
  if (pinCount > 0)
    throw new Error(
      `${pinCount} pin(s) still use this tag — reassign them first.`,
    )
  await prisma.tag.delete({ where: { id } })
  revalidatePath("/")
  revalidatePath("/admin/tags")
  redirect("/admin/tags")
}
