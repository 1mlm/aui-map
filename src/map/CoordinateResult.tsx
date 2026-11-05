"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { copyToClipboard } from "@/utils/clipboard"
import { triggerHaptic } from "@/utils/haptics"
import { useCopyFeedback } from "@/utils/useCopyFeedback"
import { formatCoordinates } from "./geo"

// what a coordinates search turns into: the spot is marked on the map, this says where it is and
// hands it straight to a maps app. Almost no words on purpose
export function CoordinateResult({
  latitude,
  longitude,
  onCampus,
  onClose,
}: {
  latitude: number
  longitude: number
  onCampus: boolean
  onClose: () => void
}) {
  const { copied, copy } = useCopyFeedback(1500)
  const pair = `${latitude},${longitude}`
  const links = [
    ["Google", `https://www.google.com/maps/search/?api=1&query=${pair}`],
    ["Apple", `https://maps.apple.com/?ll=${pair}`],
    ["Waze", `https://waze.com/ul?ll=${pair}&navigate=yes`],
  ] as const

  return (
    <div className="pointer-events-auto absolute top-[8.25rem] left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 flex-col gap-2 rounded-3xl corner-superellipse/1.2 bg-background/95 p-3 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md sm:top-4 sm:w-auto sm:max-w-none">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-2xl",
            onCampus
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/10",
          )}
        >
          <Icon icon={ICONS.pin} className="size-5" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold tabular-nums">
            {formatCoordinates({ latitude, longitude })}
          </span>
          <span className="block text-muted-foreground text-xs">
            {onCampus ? "On campus" : "Not on the campus map"}
          </span>
        </span>
        <button
          type="button"
          aria-label="Copy coordinates"
          title="Copy"
          onClick={async () => {
            triggerHaptic()
            if (
              await copyToClipboard(formatCoordinates({ latitude, longitude }))
            )
              copy(formatCoordinates({ latitude, longitude }))
          }}
          className="grid size-9 place-items-center rounded-full bg-foreground/8 hover:bg-foreground/15"
        >
          <Icon icon={copied ? ICONS.copied : ICONS.copy} className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Clear"
          title="Clear"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-foreground/8 hover:bg-foreground/15"
        >
          <Icon icon={ICONS.close} className="size-4" />
        </button>
      </div>
      <div className="flex gap-1.5">
        {links.map(([label, href]) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full corner-squircle bg-foreground/8 px-3 py-2 font-medium text-sm hover:bg-foreground/15"
          >
            <Icon icon={ICONS.openExternalMap} className="size-4" />
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
