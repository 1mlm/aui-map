// shown when the service worker can't find a cached copy of the page to fall back to — a fresh
// install with no signal, rather than a returning visit. Reachable at /~offline once precached.
export default function OfflineFallbackPage() {
  return (
    <div className="flex h-dvh w-dvw flex-col items-center justify-center gap-2 bg-background px-6 text-center text-foreground">
      <span className="text-2xl font-bold">You're offline</span>
      <span className="max-w-xs text-sm opacity-70">
        AUI Map needs to load at least once with a connection before it works
        offline.
      </span>
    </div>
  )
}
