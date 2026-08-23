"use client"

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

export function MapControls({
  onOpenNotice,
  locationStatus,
  onLocate,
  ...props
}: SearchProps &
  FilterProps & {
    onOpenNotice: () => void
    locationStatus: LocationStatus
    onLocate: () => void
  }) {
  const { search, activeTagIds } = props

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
    {
      id: "suggestions",
      icon: ICONS.suggestions,
      label: "Map Feedback",
      active: false,
      badgeCount: 0,
      contentClassName: "",
      content: <SuggestionForm />,
    },
  ]

  const buttons = (
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
            aria-label={LOCATE_TOOLTIP_TEXT[locationStatus]}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {LOCATE_TOOLTIP_TEXT[locationStatus]}
        </TooltipContent>
      </Tooltip>
    </>
  )

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
        {buttons}
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
        {buttons}
      </SquircleFuserContainer>
    </>
  )
}
