"use client"

import {
  ArrowDown02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  Compass01Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import shots from "./installShots.json"
import { type InstallPlatform, useInstallPrompt } from "./useInstallPrompt"

const DISMISSED_KEY = "aui_install_dismissed"
const SHOW_AGAIN_AFTER_MS = 3 * 24 * 60 * 60 * 1000
const WAIT_SECONDS = 10
// search engines and link previewers load the page as a phone too, they never see the gate
const BOT = /bot|crawl|spider|lighthouse|headless|preview/i

function wasRecentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return at > 0 && Date.now() - at < SHOW_AGAIN_AFTER_MS
  } catch {
    return false
  }
}

// first thing a phone sees: the map is nicer as an app. Install is the big obvious button. A
// smaller ghost one counts down from 10 and then lets them in anyway, so nobody is ever stuck.
// Never on a desktop, never once it's installed, and not again for a few days after they got in
export function InstallNudge() {
  const { platform, isPhoneDevice, installing, promptInstall } =
    useInstallPrompt()
  const [open, setOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [seconds, setSeconds] = useState(WAIT_SECONDS)

  useEffect(() => {
    if (
      platform === "none" ||
      !isPhoneDevice ||
      BOT.test(navigator.userAgent) ||
      wasRecentlyDismissed()
    )
      return
    setOpen(true)
  }, [platform, isPhoneDevice])

  useEffect(() => {
    if (!open || seconds <= 0) return
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [open, seconds])

  function enter() {
    setOpen(false)
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {}
  }

  function handleInstall() {
    triggerHaptic()
    if (platform === "prompt") {
      setOpen(false)
      void promptInstall()
    } else setGuideOpen(true)
  }

  return (
    <>
      {open && platform !== "none" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/85 p-6 backdrop-blur-xl">
          {/* biome-ignore lint/performance/noImgElement: a small static icon */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={96}
            height={96}
            className="size-24 rounded-[1.4rem] corner-squircle shadow-xl"
          />
          <p className="max-w-64 text-center text-2xl leading-tight font-semibold text-balance">
            The map is better as an app
          </p>
          <div className="flex w-full max-w-64 flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleInstall}
              className="flex w-full items-center justify-center gap-2 rounded-3xl corner-squircle bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground shadow-lg active:scale-[0.98]"
            >
              <Icon icon={ICONS.download} className="size-6" />
              Install
            </button>
            <button
              type="button"
              onClick={enter}
              disabled={seconds > 0}
              className="flex items-center justify-center gap-1.5 rounded-2xl corner-squircle px-4 py-2 text-sm font-medium text-foreground/60 tabular-nums transition-colors enabled:text-foreground enabled:ring-1 enabled:ring-foreground/20 disabled:cursor-default"
            >
              {seconds > 0 ? (
                `Wait ${seconds}`
              ) : (
                <>
                  Continue
                  <Icon icon={ArrowRight01Icon} className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {installing && <PromptPointer />}
      <IosGuide
        open={guideOpen}
        onOpenChange={setGuideOpen}
        platform={platform}
        onDone={() => {
          setGuideOpen(false)
          enter()
        }}
      />
    </>
  )
}

// while the browser's own install box is up: everything else goes dark and an arrow points up at
// it. Desktop Chrome and Samsung phones both open that box from the top of the screen
function PromptPointer() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-start bg-black/70 px-6 pt-20 text-center text-white">
      <Icon icon={ArrowUp02Icon} className="size-20 animate-bounce" />
      <p className="rounded-full bg-white px-6 py-3 text-2xl font-bold text-black">
        Install
      </p>
    </div>
  )
}

type Shot = {
  left: number
  top: number
  width: number
  height: number
  aspect: string
}

// which pictures each platform walks through. The pictures live in public/install/ and where the red
// box goes is in installShots.json (percent of the picture). To use real screenshots, replace a
// webp and adjust its four numbers
const GUIDES: Partial<Record<InstallPlatform, string[]>> = {
  "ios-safari": ["ios-1", "ios-2", "ios-3"],
  "android-manual": ["android-1", "android-2", "android-3"],
}

// a dark blurred screen, one picture at a time with a red rounded box on the thing to tap and an
// arrow at it. Next / back / close are all icons, there are no words on purpose
function IosGuide({
  open,
  onOpenChange,
  platform,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: InstallPlatform
  onDone: () => void
}) {
  const [step, setStep] = useState(0)
  if (!open) return null

  const names = GUIDES[platform]
  const isLast = !names || step === names.length - 1

  // closing with the X or Escape goes back to the first screen, only finishing the steps counts
  function close() {
    setStep(0)
    onOpenChange(false)
  }

  function next() {
    triggerHaptic("selection")
    if (isLast) {
      setStep(0)
      onDone()
    } else setStep((current) => current + 1)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black/75 p-5 backdrop-blur-md"
      onKeyDown={(event) => event.key === "Escape" && close()}
      role="presentation"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute top-4 right-4 grid size-11 place-items-center rounded-2xl corner-squircle bg-white text-black"
      >
        <Icon icon={ICONS.close} className="size-5" />
      </button>

      {!names ? (
        <div className="flex flex-col items-center gap-3 text-white">
          <Icon icon={Compass01Icon} className="size-28" />
          <Icon icon={ArrowRight01Icon} className="size-14 animate-pulse" />
        </div>
      ) : (
        <>
          <StepPicture key={names[step]} name={names[step]} />
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
              aria-label="Back"
              className="grid size-12 place-items-center rounded-2xl corner-squircle bg-white/15 text-white disabled:opacity-30"
            >
              <Icon icon={ArrowLeft01Icon} className="size-6" />
            </button>
            <div className="flex gap-2">
              {names.map((name, index) => (
                <span
                  key={name}
                  className={cn(
                    "size-2.5 rounded-full",
                    index === step ? "bg-white" : "bg-white/30",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              aria-label={isLast ? "Done" : "Next"}
              className="grid size-12 place-items-center rounded-2xl corner-squircle bg-white text-black"
            >
              <Icon
                icon={isLast ? ICONS.check : ArrowRight01Icon}
                className="size-6"
              />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function StepPicture({ name }: { name: string }) {
  const shot = (shots as Record<string, Shot>)[name]
  // the red box is in the lower half of the picture: the arrow comes from above, pointing down.
  // In the upper half it comes from below, pointing up
  const pointsDown = shot.top > 50
  return (
    <div
      className="relative w-full max-w-xs"
      style={{ aspectRatio: shot.aspect }}
    >
      {/* biome-ignore lint/performance/noImgElement: a static, pre-sized picture */}
      <img
        src={`/install/${name}.webp`}
        alt=""
        className="size-full rounded-3xl object-cover shadow-2xl"
      />
      <span
        className="absolute animate-pulse rounded-2xl ring-4 ring-red-500"
        style={{
          left: `${shot.left}%`,
          top: `${shot.top}%`,
          width: `${shot.width}%`,
          height: `${shot.height}%`,
        }}
      />
      <Icon
        icon={pointsDown ? ArrowDown02Icon : ArrowUp02Icon}
        className="absolute size-10 -translate-x-1/2 animate-bounce text-red-500 drop-shadow-lg"
        style={{
          left: `${shot.left + shot.width / 2}%`,
          [pointsDown ? "bottom" : "top"]: `${
            pointsDown ? 100 - shot.top + 1 : shot.top + shot.height + 1
          }%`,
        }}
      />
    </div>
  )
}
