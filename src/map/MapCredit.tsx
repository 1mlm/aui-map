"use client"

import Image from "next/image"
import { Icon, type HugeIcon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { cn } from "@/shadcn/utils"

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

function CreditTag({
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
    "relative -my-0.5 inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full corner-squircle bg-white/5 py-0.5 pr-3 pl-2 font-semibold text-foreground outline-none transition-all duration-200 hover:-translate-y-2 hover:scale-105 hover:bg-white/10 focus-visible:-translate-y-2 focus-visible:scale-105 focus-visible:bg-white/10 active:-translate-y-2 active:scale-105 active:bg-white/10",
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

export function NoticeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog {...{ open, onOpenChange }}>
      <DialogContent className="corner-squircle rotate-[0.25deg] gap-5 overflow-visible p-6 sm:max-w-md">
        {/* next/image would freeze the animation, this is decorative so a plain img is fine */}
        {/* biome-ignore lint/performance/noImgElement: gif needs to stay animated */}
        <img
          src="/grinning-face-with-sweat.gif"
          alt=""
          className="pointer-events-none absolute -top-8 -left-8 hidden size-16 -rotate-12 select-none sm:block"
        />
        <DialogHeader className="gap-3.5">
          <DialogTitle className="text-center text-xl">
            Hey! Quick notice
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p className="indent-6 !no-underline">
                This interactive map is an independent, unofficial project. It's{" "}
                <span className="font-semibold text-foreground">NOT</span>{" "}
                owned, affiliated with, endorsed by, or run by Al Akhawayn
                University in any way.
              </p>
              <p className="indent-6 !no-underline">
                🤓 While I{" "}
                <span className="font-semibold text-foreground">do</span> work
                as a{" "}
                <CreditTag
                  label={NEOCEDRUS.name}
                  avatarUrl={NEOCEDRUS.avatarUrl}
                  href={NEOCEDRUS.url}
                  rotation={TAG_ROTATIONS[2]}
                />{" "}
                team member for AUI, this project isn't owned by, affiliated
                with, or endorsed by neoCedrus either, in any shape, way, or
                form.
              </p>
              <p className="text-center !no-underline">
                It's a fully solo project I built on my own time to help
                newcomers find their way around campus 😋
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  )
}

export function MapCredit({ onOpen }: { onOpen: () => void }) {
  return (
    <SquircleFuserContainer
      align="bottom-center"
      superClassName="absolute bottom-0 left-1/2 -translate-x-1/2"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        Made with ❤️ by
        <CreditTag
          label={AUTHOR.name}
          avatarUrl={AUTHOR.avatarUrl}
          rotation={TAG_ROTATIONS[1]}
        />
      </button>
    </SquircleFuserContainer>
  )
}
