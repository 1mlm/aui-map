"use client"

import { type PropsWithChildren, useEffect, useRef } from "react"

// a long chart (every hour of a month) opens scrolled to the newest bar
export function ScrollToEnd({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth })
  }, [])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
