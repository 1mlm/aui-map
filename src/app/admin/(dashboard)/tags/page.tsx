import type { IconName } from "@/map/iconRegistry"
import { prisma } from "@/utils/prisma"
import type { TagRow } from "./TagsTable"
import { TagsTable } from "./TagsTable"

export default async function AdminTagsPage() {
  const tagRows = await prisma.tag.findMany({
    include: { _count: { select: { pins: true } } },
    orderBy: { label: "asc" },
  })

  const tags: TagRow[] = tagRows.map((tag) => ({
    id: tag.id,
    label: tag.label,
    icon: tag.icon as IconName,
    color: tag.color,
    sizeScale: tag.sizeScale,
    pinCount: tag._count.pins,
  }))

  return <TagsTable {...{ tags }} />
}
