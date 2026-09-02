"use client"

import { type ReactNode, useEffect, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip"
import { ICONS } from "@/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { cn } from "@/shadcn/utils"
import { ContributeMenu, type ContributePin } from "./ContributeMenu"
import { SearchField, type SearchProps } from "./MapSearch"
import { type FilterProps, TagPills } from "./MapTagFilter"
import type { CompassPermission } from "./useCompassHeading"
import type { LocationStatus } from "./useUserLocation"

const LOCATE_LABEL: Record<LocationStatus, string> = {
  idle: "Locate",
  requesting: "Finding…",
  granted: "Locate",
  denied: "No access",
  unavailable: "Retry",
}
const OFF_CAMPUS_TEXT = "You're not on campus 💀??"
// a browser with no GPS falls back to looking up the wifi network's registered location,
// which on a campus resolves to one arbitrary point for the whole network -- hence the
// classic "it thinks I'm at that roundabout" on a desktop. Past this the fix is too coarse
// to mean anything at building scale, so the tooltip says why rather than letting people
// assume the map itself is wrong
const VAGUE_ACCURACY_METERS = 120
// flips the Contribute button's pulse off for good, for anyone who's ever clicked it — set on
// first click, checked on mount, never cleared
const CONTRIBUTE_SEEN_KEY = "aui-map:contribute-seen"

type MapControl = {
  id: string
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  active?: boolean
  badgeCount?: number
  iconClassName?: string
  className?: string
  onClick?: () => void
  // only set when there is something to say beyond the label already under the glyph
  tooltip?: string | null
  popover?: { className: string; content: ReactNode }
  // the roomy layout already has a permanent filter bar docked along the bottom, so its copy of
  // the filter button would be a second control for something already on screen
  compactOnly?: boolean
  // the compact bar's own copy would be a second, more cramped "get located" flow next to
  // LocateFloatingButton's -- that one already owns this job on mobile
  fullOnly?: boolean
}

export function MapControls({
  onOpenNotice,
  locationStatus,
  isOffCampus,
  accuracy,
  onLocate,
  compassPermission,
  onRequestCompass,
  contributePins,
  ...props
}: SearchProps &
  FilterProps & {
    onOpenNotice: () => void
    locationStatus: LocationStatus
    isOffCampus: boolean
    accuracy: number | null
    onLocate: () => void
    compassPermission: CompassPermission
    onRequestCompass: () => void
    contributePins: ContributePin[]
  }) {
  // controlled only so the menu can close itself once something has been sent. Two independent
  // states, not one shared boolean -- both the compact and full control bars are always mounted
  // (see the render's own comment on why), so a single shared `open` flips both Popover instances
  // true on one click; the hidden instance's own dismiss-layer then sees that same click as
  // happening outside its own (still off-screen) trigger and immediately closes it right back down
  const [contributeOpenCompact, setContributeOpenCompact] = useState(false)
  const [contributeOpenFull, setContributeOpenFull] = useState(false)
  const closeContribute = () => {
    setContributeOpenCompact(false)
    setContributeOpenFull(false)
  }
  // starts false on the server so hydration always matches, then flips true on mount if this
  // browser hasn't clicked Contribute yet -- the pulse announcing the fix is worth a one-frame
  // delay rather than risking a hydration mismatch against localStorage
  const [contributeUnseen, setContributeUnseen] = useState(false)
  useEffect(() => {
    if (!localStorage.getItem(CONTRIBUTE_SEEN_KEY)) setContributeUnseen(true)
  }, [])
  function markContributeSeen() {
    localStorage.setItem(CONTRIBUTE_SEEN_KEY, "1")
    setContributeUnseen(false)
  }
  const { search, activeTagIds } = props
  const fixIsVague =
    locationStatus === "granted" &&
    accuracy !== null &&
    accuracy > VAGUE_ACCURACY_METERS
  const locateTooltip = isOffCampus
    ? OFF_CAMPUS_TEXT
    : fixIsVague
      ? `Your device placed you within about ${Math.round(accuracy)}m, so that is your wifi network's registered spot rather than a real fix. A phone with GPS will put you on the right building.`
      : null
  // once located, iOS still gates the compass behind its own explicit tap -- rather than a
  // separate control for that, the same button just asks for the next thing it needs
  const needsCompassTap =
    locationStatus === "granted" && compassPermission === "idle"
  const isBusy =
    locationStatus === "requesting" || compassPermission === "requesting"

  const controls: MapControl[] = [
    {
      id: "search",
      icon: ICONS.search,
      label: "Search",
      active: search.length > 0,
      popover: {
        className: "flex w-80 flex-col gap-2.5",
        content: <SearchField {...props} />,
      },
    },
    {
      id: "filter",
      icon: ICONS.filter,
      label: "Filter",
      active: activeTagIds.size > 0,
      badgeCount: activeTagIds.size,
      compactOnly: true,
      popover: {
        className: "flex w-72 flex-wrap gap-1.5",
        content: <TagPills {...props} />,
      },
    },
    {
      id: "locate",
      fullOnly: true,
      icon: isBusy
        ? ICONS.loading
        : needsCompassTap
          ? ICONS.heading
          : ICONS.locate,
      label: isOffCampus
        ? "Off campus"
        : needsCompassTap
          ? "Get orientation"
          : LOCATE_LABEL[locationStatus],
      active: locationStatus === "granted" && !needsCompassTap,
      iconClassName: isBusy ? "animate-spin" : undefined,
      className: cn(
        isOffCampus && "motion-safe:animate-wiggle",
        needsCompassTap && "animate-pulse-violet",
      ),
      tooltip: locateTooltip,
      onClick: needsCompassTap ? onRequestCompass : onLocate,
    },
    {
      id: "contribute",
      icon: ICONS.contributeMenu,
      label: "Contribute",
      className: contributeUnseen ? "animate-pulse-violet" : undefined,
      onClick: markContributeSeen,
      popover: {
        className: "flex max-h-[70vh] w-80 flex-col gap-2 overflow-y-auto",
        content: (
          <ContributeMenu items={contributePins} onClose={closeContribute} />
        ),
      },
    },
    {
      id: "about",
      icon: ICONS.notice,
      label: "About",
      onClick: onOpenNotice,
    },
  ]

  function renderControls(compact: boolean) {
    return controls
      .filter(
        (control) =>
          (compact || !control.compactOnly) && (!compact || !control.fullOnly),
      )
      .map(
        ({
          id,
          icon,
          label,
          active,
          badgeCount,
          iconClassName,
          className,
          onClick,
          tooltip,
          popover,
        }) => {
          const plainButton = (
            <IconButton
              aria-label={tooltip ?? label}
              tone={active ? "primary" : "subtle"}
              layout={compact ? "stack" : "inline"}
              {...{ icon, label, iconClassName, className, onClick }}
            />
          )
          const button = tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>{plainButton}</TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-64">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            plainButton
          )

          return (
            <span key={id} className="relative">
              {popover ? (
                <Popover
                  open={
                    id === "contribute"
                      ? compact
                        ? contributeOpenCompact
                        : contributeOpenFull
                      : undefined
                  }
                  onOpenChange={
                    id === "contribute"
                      ? compact
                        ? setContributeOpenCompact
                        : setContributeOpenFull
                      : undefined
                  }
                >
                  <PopoverTrigger asChild>{button}</PopoverTrigger>
                  <PopoverContent className={popover.className}>
                    {popover.content}
                  </PopoverContent>
                </Popover>
              ) : (
                button
              )}
              {Boolean(badgeCount) && (
                <span className="pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground ring-2 ring-background">
                  {badgeCount}
                </span>
              )}
            </span>
          )
        },
      )
  }

  // both variants render unconditionally; which one is actually visible is decided by a CSS
  // container query (globals.css's .map-controls-compact / .map-controls-full rules) rather than
  // a JS-measured boolean, so the right one is already showing on the very first frame instead of
  // flashing the wrong one while JS boots up
  return (
    <>
      <div className="map-controls-compact pointer-events-auto absolute top-4 left-1/2 flex -translate-x-1/2 items-center justify-center gap-1.5 rounded-3xl corner-squircle bg-background/90 px-3 py-2 drop-shadow-lg drop-shadow-black/40 backdrop-blur-md">
        {renderControls(true)}
      </div>

      <SquircleFuserContainer
        align="top-right"
        superClassName="map-controls-full pointer-events-auto absolute top-0 right-0"
        className="gap-1.5"
      >
        {renderControls(false)}
      </SquircleFuserContainer>
    </>
  )
}
