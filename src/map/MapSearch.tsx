"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"

export type SearchProps = {
  search: string
  onSearchChange: (value: string) => void
}

export function SearchField({ search, onSearchChange }: SearchProps) {
  return (
    <>
      <Icon icon={ICONS.search} className="shrink-0 text-muted-foreground" />
      <input
        // biome-ignore lint/a11y/noAutofocus: the field only exists once the user opened it
        autoFocus
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search places..."
        className="h-7 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {search && (
        <button type="button" onClick={() => onSearchChange("")} aria-label="Clear search">
          <Icon icon={ICONS.clear} className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </>
  )
}
