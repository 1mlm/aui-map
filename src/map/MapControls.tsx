"use client"

import { AnimatePresence } from "motion/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip"
import { ICONS } from "@/icons"
import { Dialog, DialogContent, DialogTitle } from "@/shadcn/ui/dialog"
import { InputGroupButton } from "@/shadcn/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { cn } from "@/shadcn/utils"
import { ContributeMenu, type ContributePin } from "./ContributeMenu"
import { InstallPromptButton } from "./InstallPromptButton"
import { SearchField, type SearchProps } from "./MapSearch"
import type { CompassPermission } from "./useCompassHeading"
import { useInstallPrompt } from "./useInstallPrompt"
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
  // a single shared boolean is enough here, unlike the popover-based controls -- a Dialog is one
  // portal-rendered modal regardless of which of the two (compact/full) trigger buttons opened
  // it, not a separate instance anchored to each
  const [contributeOpen, setContributeOpen] = useState(false)
  function openContribute() {
    setContributeOpen(true)
  }
  const { search } = props
  const { canInstall, promptInstall } = useInstallPrompt()
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
        needsCompassTap && "animate-pulse-attention",
      ),
      tooltip: locateTooltip,
      onClick: needsCompassTap ? onRequestCompass : onLocate,
    },
    {
      id: "contribute",
      icon: ICONS.contributeMenu,
      label: "Contribute",
      onClick: openContribute,
    },
    ...(canInstall
      ? [
          {
            id: "install",
            // compact already gets its own bespoke button next to the searchbar
            fullOnly: true,
            icon: ICONS.download,
            label: "Install",
            className: "animate-pulse-attention",
            onClick: promptInstall,
          } satisfies MapControl,
        ]
      : []),
    {
      id: "about",
      // mobile's own About lives in the credit strip fused to the bottom of the screen now
      // (MapCredit, in MapExperience) -- no room to spare for a second entry point up here too
      fullOnly: true,
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
                <Popover>
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
      {/* mobile: the searchbar (full width, a real always-there input, not a button that opens
          one) with Contribute docked at its own right edge inside the same translucent pill,
          plus Install as its own separate floating button when the browser says the app is
          installable. Locate has its own floating button, About lives in the credit strip fused
          to the bottom of the screen (MapCredit, in MapExperience). Same inset-3 margin the
          filter row and credit strip use, so the chrome reads as one consistent floating
          language top to bottom */}
      <div className="map-controls-compact pointer-events-auto absolute inset-x-3 top-3 flex items-center gap-2">
        <SearchField
          big
          {...props}
          trailing={
            <InputGroupButton
              size="icon-sm"
              variant="ghost"
              aria-label="Contribute"
              className="size-9 rounded-full corner-superellipse/1.2!"
              onClick={openContribute}
            >
              <Icon icon={ICONS.contributeMenu} className="size-5" />
            </InputGroupButton>
          }
        />
        <AnimatePresence>
          {canInstall && (
            <InstallPromptButton key="install" onInstall={promptInstall} />
          )}
        </AnimatePresence>
      </div>

      <SquircleFuserContainer
        align="top-right"
        superClassName="map-controls-full pointer-events-auto absolute top-0 right-0"
        className="gap-1.5"
      >
        {renderControls(false)}
      </SquircleFuserContainer>

      {/* a modal, not a popover -- the form underneath (file uploads, a map picker, multi-step)
          is real content to focus on, not a quick anchored menu next to the icon that opened it */}
      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-2 overflow-y-auto sm:max-w-sm">
          <DialogTitle className="sr-only">Contribute</DialogTitle>
          <ContributeMenu
            items={contributePins}
            onClose={() => setContributeOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
