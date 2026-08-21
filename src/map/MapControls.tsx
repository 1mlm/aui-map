"use client"

import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"
import { SearchField, type SearchProps } from "./MapSearch"
import { type FilterProps, TagPills } from "./MapTagFilter"
import { SuggestionForm } from "./SuggestionForm"

export function MapControls({
  compact,
  onOpenNotice,
  ...props
}: SearchProps & FilterProps & { compact: boolean; onOpenNotice: () => void }) {
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

      {compact && (
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
      )}
    </SquircleFuserContainer>
  )
}
