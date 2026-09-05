"use client"

import { motion } from "motion/react"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"

// same "come tap me" glow every other undiscovered-but-useful control gets (Find Me, first-seen
// Contribute) -- this one's condition is just "the browser says it's installable right now"
export function InstallPromptButton({ onInstall }: { onInstall: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <IconButton
        icon={ICONS.download}
        aria-label="Install app"
        tone="floating"
        shape="corner-superellipse/1.2"
        iconClassName="size-5"
        className="size-12 shrink-0 shadow-lg drop-shadow-black/40 animate-pulse-attention"
        onClick={onInstall}
      />
    </motion.div>
  )
}
