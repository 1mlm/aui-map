"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shadcn/ui/input-group"

export type SearchProps = {
  search: string
  onSearchChange: (value: string) => void
}

export function SearchField({ search, onSearchChange }: SearchProps) {
  return (
    <InputGroup className="rounded-[calc(var(--radius-3xl)-0.75rem)] corner-squircle">
      <InputGroupAddon>
        <Icon icon={ICONS.search} />
      </InputGroupAddon>
      <InputGroupInput
        autoFocus
        type="search"
        enterKeyHint="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search places..."
      />
      {search && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            className="rounded-full corner-squircle"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <Icon icon={ICONS.clear} />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
