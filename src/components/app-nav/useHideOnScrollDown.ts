import { useEffect, useRef, useState } from "react"

// hides the bar once the user has scrolled down a bit and is actively
// scrolling further down, brings it back the moment they scroll up —
// the same pattern most mobile apps use for a top bar that shouldn't eat
// screen space while reading
export function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrolledPastThreshold = currentScrollY > 64
      const scrollingDown = currentScrollY > lastScrollY.current
      setHidden(scrolledPastThreshold && scrollingDown)
      lastScrollY.current = currentScrollY
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return hidden
}
