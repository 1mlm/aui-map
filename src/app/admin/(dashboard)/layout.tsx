import type { PropsWithChildren } from "react"
import { AppShell } from "@/components/sidebar/AppShell"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAuth()

  const [pins, tags, submissions, suggestions] = await Promise.all([
    prisma.pin.count(),
    prisma.tag.count(),
    prisma.submission.count({ where: { status: "PENDING" } }),
    prisma.suggestion.count({ where: { resolved: false } }),
  ])

  return (
    <AppShell counts={{ pins, tags, submissions, suggestions }}>
      {children}
    </AppShell>
  )
}
