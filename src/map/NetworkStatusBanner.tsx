"use client"

import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { useNetworkStatus } from "@/utils/useNetworkStatus"

// only ever shows one line at a time — offline takes priority since it's the more actionable of
// the two (nothing here needs a live connection except sending feedback), a slow connection is
// just a heads-up that the map itself is already handling via its own cached image
export function NetworkStatusBanner() {
  const { online, slowConnection } = useNetworkStatus()
  if (online && !slowConnection) return null

  return (
    <SquircleFuserContainer
      align="top-center"
      superClassName="absolute top-0 left-1/2 -translate-x-1/2"
      className="gap-2 text-sm text-muted-foreground"
    >
      <Icon
        icon={online ? ICONS.slowConnection : ICONS.offline}
        className="size-4"
      />
      {online ? "Slow connection" : "Offline — showing the cached map"}
    </SquircleFuserContainer>
  )
}
