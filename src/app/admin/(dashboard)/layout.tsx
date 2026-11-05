import type { PropsWithChildren } from "react"
import { AppShell } from "@/components/sidebar/AppShell"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAuth()

  const [pins, tags, searchMisses, comments] = await Promise.all([
    prisma.pin.count(),
    prisma.tag.count(),
    prisma.searchMiss.count(),
    prisma.submission.count({ where: { kind: "PIN_EDIT", status: "PENDING" } }),
  ])

  return <AppShell counts={{ pins, tags, searchMisses, comments }}>{children}</AppShell>
}
