"use client"

import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ICON_REGISTRY, type IconName, resolveIcon } from "@/map/iconRegistry"
import { Input } from "@/shadcn/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { cn } from "@/shadcn/utils"

const ICON_NAMES = Object.keys(ICON_REGISTRY) as IconName[]

// grid-of-buttons picker (like an emoji picker) instead of a dropdown of text names — the
// icon itself is the whole point, so you should be able to see it before picking it
export function IconPicker({
  id,
  value,
  onChange,
}: {
  id?: string
  value: IconName
  onChange: (name: IconName) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const matches = ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase()),
  )

  function pick(name: IconName) {
    onChange(name)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover {...{ open }} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-9 w-fit items-center gap-2 rounded-lg corner-squircle border border-input bg-transparent px-3 text-sm"
        >
          <Icon icon={resolveIcon(value)} />
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-2 p-2">
        <Input
          autoFocus
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="corner-squircle"
        />
        <div className="grid grid-cols-6 gap-1 overflow-y-auto max-h-56">
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => pick(name)}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg corner-squircle text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
                name === value && "bg-primary/15 text-primary",
              )}
            >
              <Icon icon={resolveIcon(name)} />
            </button>
          ))}
          {matches.length === 0 && (
            <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
              No icons match.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
