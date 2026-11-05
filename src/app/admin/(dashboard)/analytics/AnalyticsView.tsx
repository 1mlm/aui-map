import Link from "next/link"
import { ScrollToEnd } from "./ScrollToEnd"

export const RANGES = {
  "1": 1,
  "7": 7,
  "30": 30,
  "90": 90,
  "365": 365,
} as const
export type RangeKey = keyof typeof RANGES
export const CHART_TYPES = ["bars", "area", "lines"] as const
export type ChartType = (typeof CHART_TYPES)[number]
export const UNITS = ["hour", "day", "week", "month"] as const
export type Unit = (typeof UNITS)[number]

export type AnalyticsData = {
  // one entry per bucket (empty ones included), oldest first. `by` is views per source
  buckets: {
    key: string
    label: string
    sub: string
    by: Record<string, number>
  }[]
  sources: { name: string; views: number; visitors: number }[]
  pages: { path: string; views: number }[]
  totals: {
    views: number
    visitors: number
    newViews: number
    regulars: number
  }
  byHourOfDay: number[]
  byWeekday: number[]
}

// any number of sources gets its own colour: hues spread by the golden angle so neighbours differ
const colorFor = (index: number) =>
  `hsl(${Math.round((index * 137.508 + 140) % 360)} 62% 48%)`

// friendly source names back to the site they stand for, for the little icon. Anything that's
// already a host name (an unknown referrer) is its own domain
const DOMAIN_BY_NAME: Record<string, string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  whatsapp: "whatsapp.com",
  x: "x.com",
  linkedin: "linkedin.com",
  tiktok: "tiktok.com",
  reddit: "reddit.com",
  discord: "discord.com",
  google: "google.com",
  bing: "bing.com",
  duckduckgo: "duckduckgo.com",
  sharepoint: "sharepoint.com",
  "aui portal": "my.aui.ma",
  "aui website": "aui.ma",
  email: "mail.google.com",
}
function SourceIcon({ name, color }: { name: string; color: string }) {
  const domain = DOMAIN_BY_NAME[name] ?? (name.includes(".") ? name : null)
  if (!domain)
    return (
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ background: color }}
      />
    )
  return (
    // biome-ignore lint/performance/noImgElement: tiny favicon, admin only
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={14}
      height={14}
      className="shrink-0 rounded-sm"
    />
  )
}
const BAR_WIDTH: Record<Unit, number> = {
  hour: 12,
  day: 22,
  week: 40,
  month: 64,
}
const CHART_HEIGHT = 220

function Pill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-foreground/8 px-3 py-1 text-sm">
      <b className="tabular-nums">{value}</b>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function StackedChart({
  data,
  unit,
  sourceOrder,
  chart,
}: {
  data: AnalyticsData["buckets"]
  unit: Unit
  sourceOrder: string[]
  chart: ChartType
}) {
  const barWidth = BAR_WIDTH[unit]
  const totals = data.map((bucket) =>
    Object.values(bucket.by).reduce((sum, value) => sum + value, 0),
  )
  const max =
    chart === "lines"
      ? Math.max(1, ...data.flatMap((bucket) => Object.values(bucket.by)))
      : Math.max(1, ...totals)
  const width = data.length * barWidth
  const yOf = (value: number) => CHART_HEIGHT - (value / max) * CHART_HEIGHT
  const xMid = (index: number) => index * barWidth + barWidth / 2
  // running stack height under each source, per bucket, for the area chart
  const stacks = data.map((bucket) => {
    let running = 0
    return sourceOrder.map((source) => {
      const from = running
      running += bucket.by[source] ?? 0
      return [from, running] as const
    })
  })
  // a label under a bar only when there's room for it
  const labelEvery = unit === "hour" ? 6 : unit === "day" ? 1 : 1
  return (
    <div className="flex">
      {/* the scale stays put while the bars scroll */}
      <div
        className="flex shrink-0 flex-col justify-between pr-2 text-right text-muted-foreground text-xs tabular-nums"
        style={{ height: CHART_HEIGHT }}
      >
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <ScrollToEnd className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={CHART_HEIGHT + 34}
          role="img"
          aria-label="Page loads over time, stacked by source"
        >
          {[0, 0.5, 1].map((fraction) => (
            <line
              key={fraction}
              x1={0}
              x2={width}
              y1={CHART_HEIGHT * (1 - fraction)}
              y2={CHART_HEIGHT * (1 - fraction)}
              stroke="currentColor"
              strokeOpacity={0.12}
            />
          ))}
          {chart === "area" &&
            sourceOrder.map((source, sourceIndex) => {
              const top = data.map(
                (_, i) => `${xMid(i)},${yOf(stacks[i][sourceIndex][1])}`,
              )
              const bottom = data
                .map((_, i) => `${xMid(i)},${yOf(stacks[i][sourceIndex][0])}`)
                .reverse()
              return (
                <polygon
                  key={source}
                  points={[...top, ...bottom].join(" ")}
                  fill={colorFor(sourceIndex)}
                  fillOpacity={0.85}
                />
              )
            })}
          {chart === "lines" &&
            sourceOrder.map((source, sourceIndex) => (
              <polyline
                key={source}
                fill="none"
                stroke={colorFor(sourceIndex)}
                strokeWidth={2}
                strokeLinejoin="round"
                points={data
                  .map((b, i) => `${xMid(i)},${yOf(b.by[source] ?? 0)}`)
                  .join(" ")}
              />
            ))}
          {data.map((bucket, index) => {
            let y = CHART_HEIGHT
            const x = index * barWidth
            const newDay = unit === "hour" && bucket.label === "00"
            return (
              <g key={bucket.key}>
                <title>{`${bucket.sub} ${bucket.label}: ${totals[index]}`}</title>
                {chart === "bars" &&
                  sourceOrder.map((source, sourceIndex) => {
                    const value = bucket.by[source] ?? 0
                    if (!value) return null
                    const h = (value / max) * CHART_HEIGHT
                    y -= h
                    return (
                      <rect
                        key={source}
                        x={x + 1}
                        y={y}
                        width={barWidth - 2}
                        height={h}
                        rx={2}
                        fill={colorFor(sourceIndex)}
                      />
                    )
                  })}
                {newDay && (
                  <line
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={CHART_HEIGHT + 6}
                    stroke="currentColor"
                    strokeOpacity={0.25}
                    strokeDasharray="3 3"
                  />
                )}
                {index % labelEvery === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.6}
                  >
                    {bucket.label}
                  </text>
                )}
                {(newDay ||
                  (unit !== "hour" && bucket.sub !== data[index - 1]?.sub)) && (
                  <text
                    x={x + 2}
                    y={CHART_HEIGHT + 30}
                    fontSize={10}
                    fontWeight={600}
                    fill="currentColor"
                  >
                    {bucket.sub}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </ScrollToEnd>
    </div>
  )
}

function Pie({
  slices,
}: {
  slices: { name: string; value: number; color: string }[]
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0)
    return <p className="text-muted-foreground text-sm">Nothing yet.</p>
  const radius = 60
  let angle = -Math.PI / 2
  return (
    <div className="flex items-center gap-4">
      <svg
        width={140}
        height={140}
        viewBox="-70 -70 140 140"
        className="shrink-0"
      >
        {slices.length === 1 ? (
          <circle r={radius} fill={slices[0].color} />
        ) : (
          slices.map((slice) => {
            const sweep = (slice.value / total) * Math.PI * 2
            const x1 = Math.cos(angle) * radius
            const y1 = Math.sin(angle) * radius
            angle += sweep
            const x2 = Math.cos(angle) * radius
            const y2 = Math.sin(angle) * radius
            return (
              <path
                key={slice.name}
                d={`M0 0 L${x1} ${y1} A${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`}
                fill={slice.color}
                stroke="var(--background)"
                strokeWidth={1.5}
              >
                <title>{`${slice.name}: ${slice.value}`}</title>
              </path>
            )
          })
        )}
        <circle r={26} fill="var(--background)" />
      </svg>
      <ul className="max-h-40 min-w-0 space-y-0.5 overflow-y-auto text-sm">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="truncate">{slice.name}</span>
            <span className="ml-auto pl-2 text-muted-foreground tabular-nums">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MiniBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {values.map((value, index) => (
        <div
          key={labels[index]}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <div
            title={`${labels[index]}: ${value}`}
            className="w-full rounded-t bg-primary"
            style={{
              height: `${(value / max) * 100}%`,
              minHeight: value ? 2 : 0,
            }}
          />
          <span className="text-[9px] text-muted-foreground leading-none">
            {labels[index]}
          </span>
        </div>
      ))}
    </div>
  )
}

function Toggle<T extends string>({
  options,
  current,
  href,
  label,
}: {
  options: readonly T[]
  current: T
  href: (option: T) => string
  label: (option: T) => string
}) {
  return (
    <div className="flex gap-1 text-sm">
      {options.map((option) => (
        <Link
          key={option}
          href={href(option)}
          className={`rounded-full px-3 py-1 ${option === current ? "bg-foreground text-background" : "bg-foreground/10"}`}
        >
          {label(option)}
        </Link>
      ))}
    </div>
  )
}

export function AnalyticsView({
  data,
  range,
  unit,
  chart,
}: {
  data: AnalyticsData
  range: RangeKey
  unit: Unit
  chart: ChartType
}) {
  const sourceOrder = data.sources.map((source) => source.name)
  const regularsNote = data.totals.regulars
  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="mr-auto font-semibold text-xl">Analytics</h1>
        <Toggle
          options={Object.keys(RANGES) as RangeKey[]}
          current={range}
          href={(option) =>
            `/admin/analytics?range=${option}&by=${unit}&chart=${chart}`
          }
          label={(option) =>
            option === "1" ? "24h" : option === "365" ? "1y" : `${option}d`
          }
        />
        <Toggle
          options={UNITS}
          current={unit}
          href={(option) =>
            `/admin/analytics?range=${range}&by=${option}&chart=${chart}`
          }
          label={(option) => option}
        />
        <Toggle
          options={CHART_TYPES}
          current={chart}
          href={(option) =>
            `/admin/analytics?range=${range}&by=${unit}&chart=${option}`
          }
          label={(option) => option}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill label="loads" value={data.totals.views} />
        <Pill label="people" value={data.totals.visitors} />
        <Pill label="first visits" value={data.totals.newViews} />
        <Pill label="came back 3+ days" value={regularsNote} />
      </div>

      <section className="space-y-2">
        <StackedChart
          data={data.buckets}
          unit={unit}
          sourceOrder={sourceOrder}
          chart={chart}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {sourceOrder.map((name, index) => (
            <span key={name} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: colorFor(index) }}
              />
              {name}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-medium text-sm">Where from</h2>
          <Pie
            slices={data.sources.map((source, index) => ({
              name: source.name,
              value: source.views,
              color: colorFor(index),
            }))}
          />
        </section>
        <section className="space-y-2">
          <h2 className="font-medium text-sm">New vs back</h2>
          <Pie
            slices={[
              {
                name: "First visit",
                value: data.totals.newViews,
                color: colorFor(0),
              },
              {
                name: "Came back",
                value: data.totals.views - data.totals.newViews,
                color: colorFor(1),
              },
            ].filter((slice) => slice.value > 0)}
          />
        </section>
        <section className="space-y-2">
          <h2 className="font-medium text-sm">Hour of day</h2>
          <MiniBars
            values={data.byHourOfDay}
            labels={data.byHourOfDay.map((_, hour) => String(hour))}
          />
        </section>
        <section className="space-y-2">
          <h2 className="font-medium text-sm">Day of week</h2>
          <MiniBars
            values={data.byWeekday}
            labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
          />
        </section>
      </div>

      <section className="space-y-1">
        <h2 className="font-medium text-sm">Most opened</h2>
        <div className="grid gap-x-8 sm:grid-cols-2">
          {data.pages.map((page) => (
            <div key={page.path} className="flex justify-between text-sm">
              <span className="truncate">{page.path}</span>
              <span className="pl-2 text-muted-foreground tabular-nums">
                {page.views}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
