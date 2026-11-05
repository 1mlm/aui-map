import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/utils/prisma"

export const metadata: Metadata = { title: "Analytics" }
export const dynamic = "force-dynamic"

const RANGES = { "7": 7, "30": 30, "90": 90, all: 3650 } as const
type RangeKey = keyof typeof RANGES

type Row = Record<string, string | number | bigint | Date>
const num = (value: unknown) => Number(value ?? 0)

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range } = await searchParams
  const rangeKey: RangeKey =
    range && range in RANGES ? (range as RangeKey) : "30"
  const since = new Date(Date.now() - RANGES[rangeKey] * 24 * 60 * 60 * 1000)

  const [totals, daily, sources, pages, regulars] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      select count(*) as views, count(distinct "visitorId") as visitors,
             count(distinct "visitorId") filter (where "isNew") as new_visitors
      from "PageView" where "createdAt" >= ${since}`,
    prisma.$queryRaw<Row[]>`
      select to_char("createdAt", 'YYYY-MM-DD') as day, count(*) as views,
             count(distinct "visitorId") as visitors
      from "PageView" where "createdAt" >= ${since} group by 1 order by 1 desc limit 120`,
    prisma.$queryRaw<Row[]>`
      select source, count(*) as views, count(distinct "visitorId") as visitors
      from "PageView" where "createdAt" >= ${since} group by 1 order by 2 desc limit 25`,
    prisma.$queryRaw<Row[]>`
      select path, count(*) as views from "PageView"
      where "createdAt" >= ${since} group by 1 order by 2 desc limit 25`,
    prisma.$queryRaw<Row[]>`
      select count(*) as regulars from (
        select "visitorId" from "PageView" where "createdAt" >= ${since}
        group by 1 having count(distinct date_trunc('day', "createdAt")) >= 3) t`,
  ])

  const views = num(totals[0]?.views)
  const visitors = num(totals[0]?.visitors)
  const newVisitors = num(totals[0]?.new_visitors)
  const maxDaily = Math.max(1, ...daily.map((row) => num(row.views)))

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-xl">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Page loads of the public map. No IPs, one anonymous cookie per
            browser.
          </p>
        </div>
        <div className="flex gap-1 text-sm">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={`/admin/analytics?range=${key}`}
              className={`rounded-full px-3 py-1 ${key === rangeKey ? "bg-foreground text-background" : "bg-foreground/10"}`}
            >
              {key === "all" ? "All time" : `${key} days`}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Page loads", views],
          ["Visitors", visitors],
          ["First time", newVisitors],
          ["Came back 3+ days", num(regulars[0]?.regulars)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border p-3">
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="font-semibold text-2xl tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Per day</h2>
        {daily.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing yet.</p>
        )}
        {daily.map((row) => (
          <div
            key={String(row.day)}
            className="flex items-center gap-3 text-sm"
          >
            <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
              {String(row.day)}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(num(row.views) / maxDaily) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right tabular-nums">
              {num(row.views)} / {num(row.visitors)}
            </span>
          </div>
        ))}
        <p className="text-muted-foreground text-xs">loads / visitors</p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-1">
          <h2 className="font-medium">Where they came from</h2>
          {sources.map((row) => (
            <div
              key={String(row.source)}
              className="flex justify-between text-sm"
            >
              <span>{String(row.source)}</span>
              <span className="tabular-nums text-muted-foreground">
                {num(row.views)} loads, {num(row.visitors)} people
              </span>
            </div>
          ))}
          <p className="pt-1 text-muted-foreground text-xs">
            Tag a link with ?s=poster (any word) to see it here by name.
          </p>
        </section>
        <section className="space-y-1">
          <h2 className="font-medium">Most opened</h2>
          {pages.map((row) => (
            <div
              key={String(row.path)}
              className="flex justify-between text-sm"
            >
              <span>{String(row.path)}</span>
              <span className="tabular-nums text-muted-foreground">
                {num(row.views)}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
