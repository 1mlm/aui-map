import Image from "next/image"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"

export function MapBrand() {
  return (
    <SquircleFuserContainer
      align="top-left"
      superClassName="map-brand pointer-events-auto absolute top-0 left-0"
      className="gap-3 pr-10 pl-4"
    >
      <Image
        src="/icon.webp"
        alt=""
        width={36}
        height={36}
        unoptimized
        className="size-9"
      />
      {/* the badge hangs off the wordmark's top-right corner, so it needs the text as its anchor */}
      <span className="relative pr-3 text-2xl font-bold whitespace-nowrap">
        AUI Map
        <span className="absolute -top-1 left-full flex -translate-x-8 rotate-6 items-center gap-1 rounded-full corner-squircle bg-violet-500/90 px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm shadow-black/40 hover:scale-110 duration-75 select-none">
          <Icon icon={ICONS.beta} className="size-2.5" />
          BETA
        </span>
      </span>
    </SquircleFuserContainer>
  )
}
