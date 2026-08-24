"use client"

import { useState } from "react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"
import type { LocationStatus } from "./useUserLocation"
import { SearchField, type SearchProps } from "./MapSearch"
import { type FilterProps, TagPills } from "./MapTagFilter"
import { SuggestionForm } from "./SuggestionForm"

const LOCATE_TOOLTIP_TEXT: Record<LocationStatus, string> = {
  idle: "Use my location",
  requesting: "Finding you…",
  granted: "Center me",
  denied: "Location unavailable",
}
const OFF_CAMPUS_TEXT = "You're not on campus 💀??"

export function MapControls({
  onOpenNotice,
  locationStatus,
  isOffCampus,
  onLocate,
  ...props
}: SearchProps &
  FilterProps & {
    onOpenNotice: () => void
    locationStatus: LocationStatus
    isOffCampus: boolean
    onLocate: () => void
  }) {
  const { search, activeTagIds } = props
  // one state per rendered variant (compact and full both mount unconditionally, see below) —
  // sharing a single controlled Popover's open state across two separate mounted instances made
  // each one's outside-click dismissal see the other's portaled content as "outside" and close
  // itself immediately, so opening either one visually did nothing
  const [compactSuggestionsOpen, setCompactSuggestionsOpen] = useState(false)
  const [fullSuggestionsOpen, setFullSuggestionsOpen] = useState(false)

  const popoverButtons = [
    {
      id: "search",
      icon: ICONS.search,
      label: "Search",
      active: search.length > 0,
      badgeCount: 0,
      contentClassName: "flex items-center gap-2.5",
      content: <SearchField {...props} />,
    },
    {
      id: "filters",
      icon: ICONS.filter,
      label: "Filters",
      active: activeTagIds.size > 0,
      badgeCount: activeTagIds.size,
      contentClassName: "flex flex-wrap gap-1.5",
      content: <TagPills {...props} />,
    },
  ]

  function renderButtons(
    suggestionsOpen: boolean,
    setSuggestionsOpen: (open: boolean) => void,
  ) {
    return (
      <>
        {popoverButtons.map(
          ({
            id,
            icon,
            label,
            active,
            badgeCount,
            contentClassName,
            content,
          }) => (
            <span key={id} className="relative">
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <IconButton
                        aria-label={label}
                        tone={active ? "primary" : "subtle"}
                        {...{ icon }}
                      />
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {label}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent className={contentClassName}>
                  {content}
                </PopoverContent>
              </Popover>
              {badgeCount > 0 && (
                <span className="pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
                  {badgeCount}
                </span>
              )}
            </span>
          ),
        )}

        <Popover open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <IconButton aria-label="Feedback" icon={ICONS.suggestions} />
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Feedback
            </TooltipContent>
          </Tooltip>
          <PopoverContent>
            <SuggestionForm onSent={() => setSuggestionsOpen(false)} />
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              icon={
                locationStatus === "requesting" ? ICONS.loading : ICONS.locate
              }
              iconClassName={
                locationStatus === "requesting" ? "animate-spin" : undefined
              }
              onClick={onLocate}
              tone={locationStatus === "granted" ? "primary" : "subtle"}
              aria-label={
                isOffCampus
                  ? OFF_CAMPUS_TEXT
                  : LOCATE_TOOLTIP_TEXT[locationStatus]
              }
              className={isOffCampus ? "animate-wiggle" : undefined}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {isOffCampus
              ? OFF_CAMPUS_TEXT
              : LOCATE_TOOLTIP_TEXT[locationStatus]}
          </TooltipContent>
        </Tooltip>
      </>
    )
  }

  // compact (mobile-width) screens have no viewport-corner "frame" for the pill to fuse into, and
  // have no separate MapCredit line to reach the notice dialog from — so this variant goes
  // standalone and centered instead of docking to the corner, and carries its own about button.
  // Both this and the corner-fused variant below render unconditionally; which one is actually
  // visible is decided by a CSS container query (globals.css's .map-controls-compact /
  // .map-controls-full rules) rather than a JS-measured boolean, so the right one is already
  // showing on the very first frame instead of flashing the wrong one while JS boots up
  return (
    <>
      <div className="map-controls-compact pointer-events-auto absolute top-4 left-1/2 flex -translate-x-1/2 items-center justify-center gap-2.5 rounded-full corner-squircle bg-background px-4 py-2.5 drop-shadow-lg drop-shadow-black/40">
        {renderButtons(compactSuggestionsOpen, setCompactSuggestionsOpen)}
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              icon={ICONS.notice}
              onClick={onOpenNotice}
              aria-label="About this project"
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            About this project
          </TooltipContent>
        </Tooltip>
      </div>

      <SquircleFuserContainer
        align="top-right"
        superClassName="map-controls-full pointer-events-auto absolute top-0 right-0"
        className="gap-2"
      >
        {renderButtons(fullSuggestionsOpen, setFullSuggestionsOpen)}
      </SquircleFuserContainer>
    </>
  )
}
