import Image from "next/image"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"

const AUTHOR = {
  name: "Malik Lahlou",
  githubUrl: "https://github.com/1mlm",
  avatarUrl: "https://github.com/1mlm.png",
}
const REPO = { label: "1mlm/aui-map", url: "https://github.com/1mlm/aui-map" }

const pillClassName =
  "-my-1 flex items-center gap-1.5 rounded-full corner-squircle py-1 pr-2 pl-1 font-medium transition-colors hover:bg-foreground/10"

export function MapCredit({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <SquircleFuserContainer align="bottom-left" superClassName="absolute bottom-0 left-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              icon={ICONS.github}
              onClick={() => window.open(REPO.url, "_blank", "noopener,noreferrer")}
              aria-label="Source Code"
            />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            Source Code
          </TooltipContent>
        </Tooltip>
      </SquircleFuserContainer>
    )

  return (
    <SquircleFuserContainer
      align="bottom-left"
      superClassName="absolute bottom-0 left-0"
      className="gap-1.5 text-sm"
    >
      <span className="text-muted-foreground">Made with ❤️ by</span>
      <a href={AUTHOR.githubUrl} target="_blank" rel="noopener noreferrer" className={pillClassName}>
        <Image src={AUTHOR.avatarUrl} alt="" width={20} height={20} className="rounded-full" />
        {AUTHOR.name}
      </a>
      <span className="text-muted-foreground">in</span>
      <a href={REPO.url} target="_blank" rel="noopener noreferrer" className={pillClassName}>
        <Icon icon={ICONS.github} className="ml-1" />
        {REPO.label}
      </a>
    </SquircleFuserContainer>
  )
}
