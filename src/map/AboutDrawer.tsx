"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { BottomDrawer } from "@/components/BottomDrawer"
import { type HugeIcon, Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { SuggestionForm } from "./SuggestionForm"
import { useSharedFeedbackDraft } from "./useSharedFeedbackDraft"

const AUTHOR = {
  name: "Malik Lahlou",
  githubUrl: "https://github.com/1mlm",
  avatarUrl: "https://github.com/1mlm.png",
}
const REPO = { label: "1mlm/aui-map", url: "https://github.com/1mlm/aui-map" }
const NEOCEDRUS = {
  name: "neoCedrus",
  url: "https://neocedrus.com/",
  avatarUrl: "https://github.com/neocedrus.png",
}

// fixed tilts handed out per tag rather than randomized on the client, so each one reads as
// pinned on slightly crooked without risking a hydration mismatch from real randomness
const TAG_ROTATIONS = [
  "rotate-[0.5deg]",
  "rotate-1",
  "-rotate-[0.5deg]",
  "-rotate-1",
] as const

export function CreditTag({
  label,
  avatarUrl,
  icon,
  href,
  rotation,
}: {
  label: string
  avatarUrl?: string
  icon?: HugeIcon
  href?: string
  rotation: (typeof TAG_ROTATIONS)[number]
}) {
  const className = cn(
    // the "About the project" paragraph sets text-indent for its own first-line indent — that
    // inherits into this flex container and, since the label is a bare text node, gets applied
    // to it as if it were its own indented line, shoving it away from the icon. Reset it here
    "relative -my-0.5 inline-flex w-fit shrink-0 items-center gap-1.5 indent-0 whitespace-nowrap rounded-full corner-squircle bg-foreground/5 py-0.5 pr-3 pl-2 font-semibold text-foreground outline-none",
    // only a linked tag (opens something on click) gets the hover/press affordance — the
    // MapCredit bottom line's plain author tag isn't clickable, so it shouldn't look like it is
    href &&
      "transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-foreground/10 focus-visible:-translate-y-1 focus-visible:scale-105 focus-visible:bg-foreground/10 active:-translate-y-1 active:scale-105 active:bg-foreground/10",
    rotation,
  )

  const content = (
    <>
      {avatarUrl && (
        <Image
          src={avatarUrl}
          alt=""
          width={18}
          height={18}
          className="rounded-full"
        />
      )}
      {!avatarUrl && icon && <Icon {...{ icon }} className="size-3.5" />}
      {label}
      {href && (
        <Icon
          icon={ICONS.externalLink}
          className="absolute top-0.5 right-0.5 text-[0.5em] text-muted-foreground"
        />
      )}
    </>
  )

  if (!href) return <span className={className}>{content}</span>

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {content}
    </a>
  )
}

export function MadeWithCredit() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
      Made with ❤️ by
      <CreditTag
        label={AUTHOR.name}
        avatarUrl={AUTHOR.avatarUrl}
        href={AUTHOR.githubUrl}
        rotation={TAG_ROTATIONS[0]}
      />
      on
      <CreditTag
        label={REPO.label}
        icon={ICONS.github}
        href={REPO.url}
        rotation={TAG_ROTATIONS[3]}
      />
    </div>
  )
}

export function AboutDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const draft = useSharedFeedbackDraft()

  // a share-target hand-off should land straight in the feedback form, already open and
  // pre-filled, rather than making someone re-open the menu and retype what they just shared
  useEffect(() => {
    if (draft) setFeedbackOpen(true)
  }, [draft])

  return (
    <>
      <BottomDrawer
        {...{ open, onOpenChange }}
        title="About"
        footer={<MadeWithCredit />}
      >
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p className="indent-6">
            This interactive map is an independent, unofficial project. It's{" "}
            <span className="font-semibold text-foreground">NOT</span> owned,
            affiliated with, endorsed by, or run by Al Akhawayn University in any
            way.
          </p>
          <p className="indent-6">
            🤓 While I <span className="font-semibold text-foreground">do</span>{" "}
            work as a{" "}
            <CreditTag
              label={NEOCEDRUS.name}
              avatarUrl={NEOCEDRUS.avatarUrl}
              href={NEOCEDRUS.url}
              rotation={TAG_ROTATIONS[2]}
            />{" "}
            team member for AUI, this project isn't owned by, affiliated with, or
            endorsed by neoCedrus either, in any shape, way, or form.
          </p>
          <p className="text-center">
            It's a fully solo project I built on my own time to help newcomers
            find their way around campus 😋
          </p>
        </div>
      </BottomDrawer>

      {/* no trigger button, reporting a bug and suggesting a feature are two cards in the
          contribute drawer. This stays mounted only so an Android share-target hand-off still
          has somewhere to land, prefilled, via the draft effect above */}
      <BottomDrawer
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        title="Send feedback"
        description="Report a bug or suggest something."
      >
        <SuggestionForm
          onSent={() => setFeedbackOpen(false)}
          initialMessage={draft?.message}
          initialAttachment={draft?.attachment ?? undefined}
        />
      </BottomDrawer>
    </>
  )
}
