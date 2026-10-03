import { useSyncExternalStore } from "react"

// same cutoff as tailwind's sm: breakpoint, which is where the map's shell stops being a phone
// layout
const PHONE_QUERY = "(max-width: 639px)"

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
