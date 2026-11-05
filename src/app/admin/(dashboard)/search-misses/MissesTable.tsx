"use client"

import { Suspense, useState, useTransition } from "react"
import { Icon } from "@/components/Icon"
import { SearchBar } from "@/components/SearchBar"
import {
  CustomTable,
  type CustomTableColumn,
  type CustomTableEnumValue,
} from "@/components/table/CustomTable"
import { ICONS } from "@/icons"
import { parseCoordinateQuery } from "@/map/geo"
import { Button } from "@/shadcn/ui/button"
import { dismissSearchMiss } from "./actions"

export type AdminMiss = {
  query: string
  count: number
  firstSeen: string
  lastSeen: string
}

// what kind of thing was typed: a place name or a pair of coordinates
const kindOptions: Record<string, CustomTableEnumValue> = {
  text: { label: "Text", icon: ICONS.text, color: "grey" },
  coordinates: { label: "Coordinates", icon: ICONS.locate, color: "green" },
}
const kindOf = (miss: AdminMiss) =>
  parseCoordinateQuery(miss.query) ? "coordinates" : "text"

function DoneButton({ query, onDone }: { query: string; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Done: it's handled or it's noise"
      aria-label={`Mark "${query}" as done`}
      disabled={pending}
      className="rounded-full corner-squircle text-muted-foreground hover:bg-green-500/15 hover:text-green-600"
      onClick={() =>
        startTransition(async () => {
          const form = new FormData()
          form.set("query", query)
          await dismissSearchMiss(form)
          onDone()
        })
      }
    >
      <Icon
        icon={pending ? ICONS.loading : ICONS.check}
        className={pending ? "animate-spin" : undefined}
      />
    </Button>
  )
}

function MissesTableInner({ misses }: { misses: AdminMiss[] }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const items = misses.filter((miss) => !done.has(miss.query))
  const [resultCount, setResultCount] = useState(items.length)

  const columns: CustomTableColumn<AdminMiss>[] = [
    {
      id: "query",
      label: "Typed",
      icon: ICONS.search,
      type: "string",
      getString: (miss) => miss.query,
    },
    {
      id: "kind",
      label: "Kind",
      icon: ICONS.tag,
      type: "enum",
      enumOptions: kindOptions,
      getValue: kindOf,
    },
    {
      id: "count",
      label: "Times",
      icon: ICONS.analytics,
      type: "string",
      align: "right",
      filterType: "number",
      getString: (miss) => String(miss.count),
      getNumber: (miss) => miss.count,
    },
    {
      id: "firstSeen",
      label: "First",
      icon: ICONS.clock,
      type: "date",
      getDate: (miss) => new Date(miss.firstSeen),
    },
    {
      id: "lastSeen",
      label: "Last",
      icon: ICONS.clock,
      type: "date",
      getDate: (miss) => new Date(miss.lastSeen),
    },
    {
      id: "actions",
      label: "",
      icon: ICONS.check,
      type: "buttons",
      getButtons: (miss) => {
        const coordinates = parseCoordinateQuery(miss.query)
        return (
          <div className="flex items-center justify-end gap-1">
            {coordinates && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                title="Open this spot in Google Maps"
                className="rounded-full corner-squircle"
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in Google Maps"
                >
                  <Icon icon={ICONS.openExternalMap} />
                </a>
              </Button>
            )}
            <DoneButton
              query={miss.query}
              onDone={() =>
                setDone((current) => new Set(current).add(miss.query))
              }
            />
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <SearchBar
        className="flex-1"
        placeholder="Search what people typed..."
        trailing={`${resultCount} ${resultCount === 1 ? "search" : "searches"}`}
      />
      <CustomTable
        {...{ columns, items }}
        getItemId={(miss) => miss.query}
        emptyLabel="missed searches"
        exportFilePrefix="missed-searches"
        paginate={false}
        onVisibleCountChange={setResultCount}
      />
    </div>
  )
}

export function MissesTable(props: { misses: AdminMiss[] }) {
  return (
    <Suspense>
      <MissesTableInner {...props} />
    </Suspense>
  )
}
