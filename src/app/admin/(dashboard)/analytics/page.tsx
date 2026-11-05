import type { Metadata } from "next"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/utils/prisma"
import {
  type AnalyticsData,
  AnalyticsView,
  CHART_TYPES,
  type ChartType,
  RANGES,
  type RangeKey,
  UNITS,
  type Unit,
} from "./AnalyticsView"

export const metadata: Metadata = { title: "Analytics" }
export const dynamic = "force-dynamic"

const TZ = "Africa/Casablanca"
const MS = { hour: 3_600_000, day: 86_400_000, week: 604_800_000 }

type Row = Record<string, string | number | bigint>
const num = (value: unknown) => Number(value ?? 0)

// every bucket between two moments, gaps included, so a quiet hour is a visible empty slot
function bucketKeys(since: Date, unit: Unit) {
  const keys: { key: string; label: string; sub: string }[] = []
  const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, ...options }).format(date)
  const now = Date.now()
  let t = since.getTime()
  const step = unit === "month" ? 28 * MS.day : MS[unit]
  const seen = new Set<string>()
  while (t <= now) {
    const date = new Date(t)
    const ymd = fmt(date, { year: "numeric", month: "2-digit", day: "2-digit" })
    const hour = fmt(date, { hour: "2-digit", hourCycle: "h23" })
    const key =
      unit === "hour"
        ? `${ymd}T${hour}`
        : unit === "day"
          ? ymd
          : unit === "week"
            ? mondayOf(ymd)
            : ymd.slice(0, 7)
    if (!seen.has(key)) {
      seen.add(key)
      keys.push({
        key,
        label:
          unit === "hour"
            ? hour
            : unit === "day"
              ? ymd.slice(8)
              : unit === "week"
                ? key.slice(5)
                : fmt(date, { month: "short" }),
        sub:
          unit === "hour"
            ? fmt(date, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).replace(",", "")
            : unit === "month"
              ? fmt(date, { year: "numeric" })
              : fmt(date, { month: "short", year: "numeric" }),
      })
    }
    t += unit === "month" ? 7 * MS.day : step
  }
  return keys
}

function mondayOf(ymd: string) {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; by?: string; chart?: string }>
}) {
  const params = await searchParams
  const range: RangeKey =
    params.range && params.range in RANGES ? (params.range as RangeKey) : "30"
  let unit: Unit = (UNITS as readonly string[]).includes(params.by ?? "")
    ? (params.by as Unit)
    : range === "1"
      ? "hour"
      : "day"
  // 8760 hourly bars is a wall, past 90 days hours fall back to days
  if (unit === "hour" && RANGES[range] > 90) unit = "day"
  const since = new Date(Date.now() - RANGES[range] * MS.day)
  const trunc = Prisma.raw(`'${unit}'`)
  const tz = Prisma.raw(`'${TZ}'`)
  const keyFormat = Prisma.raw(
    unit === "hour"
      ? `'YYYY-MM-DD"T"HH24'`
      : unit === "month"
        ? `'YYYY-MM'`
        : `'YYYY-MM-DD'`,
  )

  const [series, sources, pages, totals, hours, weekdays, regulars] =
    await Promise.all([
      prisma.$queryRaw<Row[]>`
      select to_char(date_trunc(${trunc}, "createdAt" at time zone ${tz}), ${keyFormat}) as key,
             source, count(*) as views
      from "PageView" where "createdAt" >= ${since} group by 1, 2`,
      prisma.$queryRaw<Row[]>`
      select source, count(*) as views, count(distinct "visitorId") as visitors
      from "PageView" where "createdAt" >= ${since} group by 1 order by 2 desc`,
      prisma.$queryRaw<Row[]>`
      select path, count(*) as views from "PageView"
      where "createdAt" >= ${since} group by 1 order by 2 desc limit 14`,
      prisma.$queryRaw<Row[]>`
      select count(*) as views, count(distinct "visitorId") as visitors,
             count(*) filter (where "isNew") as new_views
      from "PageView" where "createdAt" >= ${since}`,
      prisma.$queryRaw<Row[]>`
      select extract(hour from "createdAt" at time zone ${tz}) as h, count(*) as views
      from "PageView" where "createdAt" >= ${since} group by 1`,
      prisma.$queryRaw<Row[]>`
      select extract(isodow from "createdAt" at time zone ${tz}) as d, count(*) as views
      from "PageView" where "createdAt" >= ${since} group by 1`,
      prisma.$queryRaw<Row[]>`
      select count(*) as regulars from (
        select "visitorId" from "PageView" where "createdAt" >= ${since}
        group by 1 having count(distinct date_trunc('day', "createdAt" at time zone ${tz})) >= 3) t`,
    ])

  // every source keeps its own name, nothing is folded into an "other"
  const sourceRows = sources.map((row) => ({
    name: String(row.source),
    views: num(row.views),
    visitors: num(row.visitors),
  }))

  const byKey = new Map<string, Record<string, number>>()
  for (const row of series) {
    const source = String(row.source)
    const entry = byKey.get(String(row.key)) ?? {}
    entry[source] = (entry[source] ?? 0) + num(row.views)
    byKey.set(String(row.key), entry)
  }

  const data: AnalyticsData = {
    buckets: bucketKeys(since, unit).map((bucket) => ({
      ...bucket,
      by: byKey.get(bucket.key) ?? {},
    })),
    sources: sourceRows,
    pages: pages.map((row) => ({
      path: String(row.path),
      views: num(row.views),
    })),
    totals: {
      views: num(totals[0]?.views),
      visitors: num(totals[0]?.visitors),
      newViews: num(totals[0]?.new_views),
      regulars: num(regulars[0]?.regulars),
    },
    byHourOfDay: Array.from({ length: 24 }, (_, hour) =>
      num(hours.find((row) => num(row.h) === hour)?.views),
    ),
    byWeekday: Array.from({ length: 7 }, (_, day) =>
      num(weekdays.find((row) => num(row.d) === day + 1)?.views),
    ),
  }

  const chart: ChartType = (CHART_TYPES as readonly string[]).includes(
    params.chart ?? "",
  )
    ? (params.chart as ChartType)
    : "bars"
  return <AnalyticsView {...{ data, range, unit, chart }} />
}
