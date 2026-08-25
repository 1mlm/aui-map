"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Tag } from "@/generated/prisma/client"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export type TagInput = Tag

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
  // a thrown Error's message gets redacted by Next in production (Server Function errors only
  // survive as an opaque digest client-side), so this has to travel back as a return value
  if (pinCount > 0) {
    return {
      error: `${pinCount} pin(s) still use this tag — reassign them first.`,
    }
  }
  await prisma.tag.delete({ where: { id } })
  revalidatePath("/")
  revalidatePath("/admin/tags")
  redirect("/admin/tags")
}
