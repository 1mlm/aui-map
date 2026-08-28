// just the two fields anything here actually reads — GeolocationCoordinates itself is a host
// object with getter-based properties, which BroadcastChannel's structured clone can't carry
// across tabs (throws DataCloneError), so every fix gets flattened to this plain shape up front
export type LatLong = { latitude: number; longitude: number }

type PositionHandler = (position: LatLong) => void
type ErrorHandler = () => void

function toLatLong({ coords }: Pick<GeolocationPosition, "coords">): LatLong {
  return { latitude: coords.latitude, longitude: coords.longitude }
}

function watchPositionDirectly(
  onPosition: PositionHandler,
  onError: ErrorHandler,
): () => void {
  const watchId = navigator.geolocation.watchPosition(
    (position) => onPosition(toLatLong(position)),
    onError,
    { enableHighAccuracy: true, timeout: 10_000 },
  )
  return () => navigator.geolocation.clearWatch(watchId)
}

const LOCK_NAME = "aui-map:geolocation-leader"
const CHANNEL_NAME = "aui-map:geolocation"

// Only one open tab needs a real GPS watch running — every other tab can just listen for what
// that one already found. Web Locks elects the leader: whichever tab grabs the lock keeps it for
// as long as it stays open, and every other tab's request just queues, so closing the leader tab
// hands the lock to the next one automatically. BroadcastChannel relays the leader's fixes to
// followers, who never call watchPosition themselves. Falls back to every tab watching
// independently if either API is unsupported.
export function watchPositionAcrossTabs(
  onPosition: PositionHandler,
  onError: ErrorHandler,
): () => void {
  if (!("locks" in navigator) || typeof BroadcastChannel === "undefined")
    return watchPositionDirectly(onPosition, onError)

  const channel = new BroadcastChannel(CHANNEL_NAME)
  const abortController = new AbortController()
  let watchId: number | null = null

  channel.onmessage = (event: MessageEvent<LatLong>) => {
    onPosition(event.data)
  }

  navigator.locks
    .request(LOCK_NAME, { signal: abortController.signal }, () => {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const latLong = toLatLong(position)
          onPosition(latLong)
          channel.postMessage(latLong)
        },
        onError,
        { enableHighAccuracy: true, timeout: 10_000 },
      )
      // holds the lock open for as long as this tab is around, rather than releasing the moment
      // the callback returns — the lock is only given back up when this promise settles
      return new Promise<void>((resolve) => {
        abortController.signal.addEventListener("abort", () => resolve())
      })
    })
    .catch(() => {
      // aborted before ever being granted (unmounted while still queued) — not a real failure
    })

  // a backgrounded tab that Chrome's Page Lifecycle freezes can come back with a stale fix —
  // force one fresh read the moment it resumes instead of waiting for the watch's next natural
  // tick. Harmless if this tab isn't the leader; it just gets an extra fix alongside the broadcast
  function handleResume() {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latLong = toLatLong(position)
        onPosition(latLong)
        channel.postMessage(latLong)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }
  document.addEventListener("resume", handleResume)

  return () => {
    document.removeEventListener("resume", handleResume)
    abortController.abort()
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    channel.close()
  }
}
