import type { PropsWithChildren } from "react"
import { AppShell } from "@/components/sidebar/AppShell"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAuth()

  const [pins, tags] = await Promise.all([
    prisma.pin.count(),
    prisma.tag.count(),
  ])

  return (
    <AppShell counts={{ pins, tags }}>
      {children}
    </AppShell>
  )
}
