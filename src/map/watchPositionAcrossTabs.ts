// just the two fields anything here actually reads — GeolocationCoordinates itself is a host
// object with getter-based properties, which BroadcastChannel's structured clone can't carry
// across tabs (throws DataCloneError), so every fix gets flattened to this plain shape up front
// accuracy is the 1-sigma radius (meters) the browser reports around the fix — how far off it
// might reasonably be, not how far off it definitely is. Indoor/WiFi-based fixes on campus can
// easily be 50-150m; a real GPS lock is usually under 20m
export type LatLong = { latitude: number; longitude: number; accuracy: number }

// "denied" means the browser will never grant this again without the user changing a site
// setting — retrying is pointless. "unavailable" covers everything else (no GPS fix, timeout,
// airplane mode, ...), which is usually transient and worth letting the user retry
export type LocationErrorReason = "denied" | "unavailable"

type PositionHandler = (position: LatLong) => void
type ErrorHandler = (reason: LocationErrorReason) => void
type ChannelMessage =
  | ({ kind: "position" } & LatLong)
  | { kind: "error"; reason: LocationErrorReason }

function toLatLong({ coords }: Pick<GeolocationPosition, "coords">): LatLong {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
  }
}

function toErrorReason(error: GeolocationPositionError): LocationErrorReason {
  return error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"
}

function watchPositionDirectly(
  onPosition: PositionHandler,
  onError: ErrorHandler,
): () => void {
  const watchId = navigator.geolocation.watchPosition(
    (position) => onPosition(toLatLong(position)),
    (error) => onError(toErrorReason(error)),
    { enableHighAccuracy: true, timeout: 10_000 },
  )
  return () => navigator.geolocation.clearWatch(watchId)
}

const LOCK_NAME = "aui-map:geolocation-leader"
const CHANNEL_NAME = "aui-map:geolocation"

// Only one open tab needs a real GPS watch running — every other tab can just listen for what
// that one already found. Web Locks elects the leader: whichever tab grabs the lock keeps it for
// as long as it stays open, and every other tab's request just queues, so closing the leader tab
// hands the lock to the next one automatically. BroadcastChannel relays the leader's fixes (and
// failures — a follower has no other way to find out the leader's watch died) to followers, who
// never call watchPosition themselves. Falls back to every tab watching independently if either
// API is unsupported.
export function watchPositionAcrossTabs(
  onPosition: PositionHandler,
  onError: ErrorHandler,
): () => void {
  if (!("locks" in navigator) || typeof BroadcastChannel === "undefined")
    return watchPositionDirectly(onPosition, onError)

  const channel = new BroadcastChannel(CHANNEL_NAME)
  const abortController = new AbortController()
  let watchId: number | null = null

  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    if (event.data.kind === "position") onPosition(event.data)
    else onError(event.data.reason)
  }

  navigator.locks
    .request(LOCK_NAME, { signal: abortController.signal }, () => {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const latLong = toLatLong(position)
          onPosition(latLong)
          channel.postMessage({
            kind: "position",
            ...latLong,
          } satisfies ChannelMessage)
        },
        (error) => {
          const reason = toErrorReason(error)
          onError(reason)
          channel.postMessage({
            kind: "error",
            reason,
          } satisfies ChannelMessage)
        },
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
        channel.postMessage({
          kind: "position",
          ...latLong,
        } satisfies ChannelMessage)
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
