"use client"

import {
  AddSquareIcon,
  ArrowDown02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  BookOpen01Icon,
  Compass01Icon,
  Copy01Icon,
  Share08Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { type InstallPlatform, useInstallPrompt } from "./useInstallPrompt"

const DISMISSED_KEY = "aui_install_dismissed"
const SHOW_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const SHOW_AFTER_MS = 5000

function wasRecentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY))
    return at > 0 && Date.now() - at < SHOW_AGAIN_AFTER_MS
  } catch {
    return false
  }
}

// a big, obvious "get the app" card for people who'd never find the browser's own install menu.
// Shows a few seconds after the map is up, never on top of the first paint, and stays away for a
// week once closed
export function InstallNudge() {
  const { platform, installing, promptInstall } = useInstallPrompt()
  const [visible, setVisible] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (platform === "none" || wasRecentlyDismissed()) return
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [platform])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {}
  }

  function handleInstall() {
    if (platform === "prompt") {
      setVisible(false)
      void promptInstall()
    } else setGuideOpen(true)
  }

  return (
    <>
      {visible && platform !== "none" && (
        <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-3xl corner-superellipse/1.2 bg-background p-3 shadow-xl ring-1 ring-foreground/10 sm:right-auto sm:left-6 sm:mx-0">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Icon icon={ICONS.download} className="size-6" />
          </span>
          <span className="min-w-0 flex-1 text-base font-semibold leading-tight">
            Get the app
          </span>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-full corner-squircle bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Install
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-foreground text-background"
          >
            <Icon icon={ICONS.close} className="size-3.5" />
          </button>
        </div>
      )}

      {installing && <PromptPointer />}
      <IosGuide
        open={guideOpen}
        onOpenChange={setGuideOpen}
        platform={platform}
        onDone={dismiss}
      />
    </>
  )
}

// while the browser's own install box is up: everything else goes dark and an arrow points at it.
// Desktop Chrome shows that box at the top near the address bar, Android Chrome as a sheet at the
// bottom
function PromptPointer() {
  const [isTouch] = useState(
    () => window.matchMedia("(pointer: coarse)").matches,
  )
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[60] flex flex-col items-center bg-black/70 px-6 text-center text-white",
        isTouch ? "justify-end pb-24" : "justify-start pt-24",
      )}
    >
      {!isTouch && (
        <Icon icon={ArrowUp02Icon} className="size-20 animate-bounce" />
      )}
      <p className="rounded-full bg-white px-6 py-3 text-2xl font-bold text-black">
        Install
      </p>
      {isTouch && (
        <Icon icon={ArrowDown02Icon} className="mt-4 size-20 animate-bounce" />
      )}
    </div>
  )
}

// a dark blurred screen with three pictures stacked top to bottom, each with a red rounded box on
// the thing to tap and an arrow at it. No words on purpose. The pictures are real screenshots when
// /install/ios-1.webp, ios-2.webp, ios-3.webp exist, and drawn mockups until then
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
  if (!open) return null

  function close() {
    onOpenChange(false)
    onDone()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center gap-4 overflow-y-auto bg-black/75 p-5 backdrop-blur-md"
      onClick={close}
      onKeyDown={(event) => event.key === "Escape" && close()}
      role="presentation"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="fixed top-4 right-4 z-10 grid size-10 place-items-center rounded-full bg-white text-black"
      >
        <Icon icon={ICONS.close} className="size-5" />
      </button>
      {platform === "ios-other" ? (
        <div className="m-auto flex flex-col items-center gap-3 text-white">
          <Icon icon={Compass01Icon} className="size-24" />
          <ArrowRight />
        </div>
      ) : (
        <div className="m-auto flex w-full max-w-xs flex-col items-stretch gap-2 py-6">
          <StepPicture n={1} src="/install/ios-1.webp">
            <div className="flex items-center justify-around rounded-2xl bg-neutral-100 px-3 py-4 text-neutral-500">
              <Icon icon={ArrowLeft01Icon} className="size-5" />
              <Icon icon={ArrowRight01Icon} className="size-5" />
              <Highlight>
                <Icon icon={Share08Icon} className="size-6 text-blue-500" />
              </Highlight>
              <Icon icon={BookOpen01Icon} className="size-5" />
              <Icon icon={Copy01Icon} className="size-5" />
            </div>
          </StepPicture>
          <FlowArrow />
          <StepPicture n={2} src="/install/ios-2.webp">
            <div className="flex flex-col overflow-hidden rounded-2xl bg-neutral-100 text-neutral-800">
              <MockRow icon={Copy01Icon} />
              <MockRow icon={StarIcon} />
              <MockRow icon={AddSquareIcon} highlighted />
            </div>
          </StepPicture>
          <FlowArrow />
          <StepPicture n={3} src="/install/ios-3.webp">
            <div className="flex items-center justify-between rounded-2xl bg-neutral-100 px-4 py-3">
              <Icon icon={ICONS.close} className="size-5 text-neutral-400" />
              <span className="grid size-10 place-items-center rounded-xl bg-primary">
                <Icon
                  icon={ICONS.pin}
                  className="size-6 text-primary-foreground"
                />
              </span>
              <Highlight>
                <Icon icon={ICONS.check} className="size-6 text-blue-500" />
              </Highlight>
            </div>
          </StepPicture>
        </div>
      )}
    </div>
  )
}

function StepPicture({
  n,
  src,
  children,
}: {
  n: number
  src: string
  children: React.ReactNode
}) {
  const [missing, setMissing] = useState(false)
  return (
    <div className="relative">
      <span className="absolute -top-3 -left-3 z-10 grid size-7 place-items-center rounded-full bg-red-500 text-sm font-bold text-white">
        {n}
      </span>
      {missing ? (
        children
      ) : (
        // biome-ignore lint/performance/noImgElement: optional user supplied screenshot, falls back to the mockup when absent
        <img
          src={src}
          alt=""
          onError={() => setMissing(true)}
          className="w-full rounded-2xl ring-4 ring-red-500"
        />
      )}
    </div>
  )
}

function FlowArrow() {
  return (
    <Icon
      icon={ArrowDown02Icon}
      className="mx-auto size-9 animate-bounce text-red-500"
    />
  )
}

function ArrowRight() {
  return <Icon icon={ArrowRight01Icon} className="size-12 animate-pulse" />
}

// the red rounded box around the thing to tap
function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="rounded-xl p-2 ring-4 ring-red-500">{children}</span>
}

function MockRow({
  icon,
  highlighted,
}: {
  icon: HugeIcon
  highlighted?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="h-2.5 w-24 rounded-full bg-neutral-300" />
      {highlighted ? (
        <Highlight>
          <Icon icon={icon} className="size-5" />
        </Highlight>
      ) : (
        <Icon icon={icon} className="size-5 text-neutral-400" />
      )}
    </div>
  )
}
