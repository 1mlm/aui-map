"use client"

import { type FormEvent, useRef } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shadcn/ui/input-group"
import { cn } from "@/shadcn/utils"

export type SearchProps = {
  search: string
  onSearchChange: (value: string) => void
}

export function SearchField({
  search,
  onSearchChange,
  big,
  bar,
  className,
}: SearchProps & {
  // the mobile compact bar's own always-visible searchbar, not a popover's -- bigger touch
  // target, no autofocus (it's mounted on first paint, not opened on demand), and translucent to
  // match the rest of the floating mobile chrome instead of a small boxed field
  big?: boolean
  // desktop: sits in the top-right control bar, so it wears the same pill look as the buttons
  // next to it instead of the boxed field
  bar?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // there's nothing left to actually submit -- typing already filters live. This exists purely
    // so the keyboard's own search/go key dismisses it, instead of needing a tap outside to close
    inputRef.current?.blur()
  }

  return (
    <form onSubmit={handleSubmit} className={cn(big && "flex-1")}>
      <InputGroup
        className={cn(
          big
            ? "map-live-blur h-12 rounded-full corner-superellipse/1.2! border-none bg-background/70 shadow-lg drop-shadow-black/40 backdrop-blur-md dark:bg-background/70"
            : bar
              ? "h-9 w-52 rounded-full corner-squircle! border-none bg-foreground/10 text-foreground/70 hover:bg-foreground/15 has-[[data-slot=input-group-control]:focus-visible]:bg-foreground/15 has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-foreground/10"
              : "rounded-[calc(var(--radius-3xl)-0.75rem)] corner-squircle!",
          className,
        )}
      >
        {/* big mode's addon defaults (pl-2, no right pad) hug the icon to the left -- fine in a
            square-ish input, but against a fully rounded h-12 pill the leading edge reads as a
            circular cap, and off-center padding there visibly skews the icon toward one side of
            it. A fixed w-12 (matches the pill's own height) with justify-center puts the icon's
            true center on the cap's center instead */}
        <InputGroupAddon
          className={big ? "w-12 justify-center pl-0" : undefined}
        >
          <Icon icon={ICONS.search} className={big ? "size-5" : undefined} />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          autoFocus={!big && !bar}
          type="search"
          enterKeyHint="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="B34, B38, Library..."
          className={big ? "text-base" : bar ? "text-sm" : undefined}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size={big ? "icon-sm" : "icon-xs"}
              variant="ghost"
              className="rounded-full corner-squircle!"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <Icon icon={ICONS.clear} />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  )
}
