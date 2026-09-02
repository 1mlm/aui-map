"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip"
import { ICONS } from "@/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { cn } from "@/shadcn/utils"
import { ContributeMenu, type ContributePin } from "./ContributeMenu"
import { SearchField, type SearchProps } from "./MapSearch"
import type { CompassPermission } from "./useCompassHeading"
import { type LocationStatus, VAGUE_ACCURACY_METERS } from "./useUserLocation"

const LOCATE_LABEL: Record<LocationStatus, string> = {
  idle: "Locate",
  requesting: "Finding…",
  granted: "Locate",
  denied: "No access",
  unavailable: "Retry",
}
const OFF_CAMPUS_TEXT = "You're not on campus 💀??"
// how long the imprecise-fix tooltip stays forced open once a vague fix lands, before it goes
// back to normal hover-only behavior
const LOCATE_HINT_VISIBLE_MS = 10_000
// flips the Contribute button's pulse off for good, for anyone who's ever clicked it — set on
// first click, checked on mount, never cleared
const CONTRIBUTE_SEEN_KEY = "aui-map:contribute-seen"

type MapControl = {
  id: string
  icon: (typeof ICONS)[keyof typeof ICONS]
  label: string
  active?: boolean
  iconClassName?: string
  className?: string
  onClick?: () => void
  // only set when there is something to say beyond the label already under the glyph
  tooltip?: string | null
  popover?: { className: string; content: ReactNode }
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
}: SearchProps & {
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
  const { search } = props
  const fixIsVague =
    locationStatus === "granted" &&
    accuracy !== null &&
    accuracy > VAGUE_ACCURACY_METERS
  const locateTooltip = isOffCampus
    ? OFF_CAMPUS_TEXT
    : fixIsVague
      ? `That's a rough fix — about ${Math.round(accuracy)}m off, from the nearest wifi router rather than your exact spot. A phone with GPS puts you right on the building.`
      : null

  // forced open for a few seconds right when a vague fix lands, instead of leaving that
  // explanation waiting behind a hover nobody thinks to try on a desktop. Reverts to Tooltip's
  // normal hover/focus behavior once the timer clears -- onOpenChange still drives it the same
  // way Radix would internally, so hovering still works throughout
  const [locateHintOpen, setLocateHintOpen] = useState(false)
  const locateHintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  useEffect(() => () => clearTimeout(locateHintTimer.current), [])
  // only on the transition into a vague fix, not on every re-render while it stays vague (the
  // fix keeps refining in the background as watchPosition reports back)
  const previousFixWasVagueRef = useRef(false)
  useEffect(() => {
    if (fixIsVague && !previousFixWasVagueRef.current) {
      clearTimeout(locateHintTimer.current)
      setLocateHintOpen(true)
      locateHintTimer.current = setTimeout(
        () => setLocateHintOpen(false),
        LOCATE_HINT_VISIBLE_MS,
      )
    }
    previousFixWasVagueRef.current = fixIsVague
  }, [fixIsVague])

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
      .filter((control) => !compact || !control.fullOnly)
      .map(
        ({
          id,
          icon,
          label,
          active,
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
            <Tooltip
              open={id === "locate" ? locateHintOpen : undefined}
              onOpenChange={id === "locate" ? setLocateHintOpen : undefined}
            >
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
