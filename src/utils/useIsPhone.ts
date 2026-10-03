import { useSyncExternalStore } from "react"

// width alone isn't enough, a desktop window dragged narrow (or short) must never get drawers
const PHONE_QUERY = "(max-width: 639px) and (pointer: coarse)"

const subscribeToPhoneQuery = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export const useIsPhone = () =>
  useSyncExternalStore(
    subscribeToPhoneQuery,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
