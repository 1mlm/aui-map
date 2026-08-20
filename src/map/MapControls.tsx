"use client"

import { AnimatePresence, motion } from "motion/react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"
import { SearchField, type SearchProps } from "./MapSearch"
import { type FilterProps, TagPills } from "./MapTagFilter"
import { SuggestionForm } from "./SuggestionForm"
import type { UserLocation } from "./UserLocationMarker"

export function MapControls({
  location,
  compact,
  onOpenNotice,
  ...props
}: SearchProps & FilterProps & { location: UserLocation; compact: boolean; onOpenNotice: () => void }) {
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

  return (
    <SquircleFuserContainer
      align="top-right"
      superClassName="pointer-events-auto absolute top-0 right-0"
      className="gap-2"
    >
      {popoverButtons.map(({ id, icon, label, active, badgeCount, contentClassName, content }) => (
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
            <PopoverContent className={contentClassName}>{content}</PopoverContent>
          </Popover>
          {badgeCount > 0 && (
            <span className="pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
              {badgeCount}
            </span>
          )}
        </span>
      ))}

      <LocateButton {...{ location }} />

      {compact && (
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton icon={ICONS.notice} onClick={onOpenNotice} aria-label="About this project" />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            About this project
          </TooltipContent>
        </Tooltip>
      )}
    </SquircleFuserContainer>
  )
}

function LocateButton({ location }: { location: UserLocation }) {
  const isLoading = location.status === "loading"
  const failure = location.status === "error" ? location.errorMessage : null

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            icon={isLoading ? ICONS.loading : ICONS.gps}
            iconClassName={isLoading ? "animate-spin" : undefined}
            onClick={location.locate}
            aria-label="Find my location"
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {failure ?? "Find my location"}
        </TooltipContent>
      </Tooltip>

      <AnimatePresence>
        {location.toastVisible && failure && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full right-0 mt-2 whitespace-nowrap rounded-full corner-squircle bg-black/70 px-3 py-1.5 text-xs text-white"
          >
            {failure}
          </motion.span>
        )}
      </AnimatePresence>
    </>
  )
}
