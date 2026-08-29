/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker"
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist"
import { CacheFirst, NetworkFirst, Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// the campus map background — cached the first time it's actually requested, not at install
// time. Precaching it would fetch it a second time on a visitor's very first load, on top of
// the page's own <img> request for the same file
const mapImageCaching: RuntimeCaching = {
  matcher: /\/auimap-1312\.webp$/,
  handler: new CacheFirst({ cacheName: "campus-map-image" }),
}

// the installed-app manifest icons — must stay off the generic static-image-assets cache
// (StaleWhileRevalidate, defaultCache) so Chrome's periodic manifest-icon check actually sees
// fresh bytes instead of a 30-day-stale copy, otherwise the OS-level "update this app?" icon
// prompt never fires when we ship a new logo
const manifestIconCaching: RuntimeCaching = {
  matcher: /\/icons\/icon-.*\.png$/,
  handler: new NetworkFirst({ cacheName: "manifest-icons" }),
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [mapImageCaching, manifestIconCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document"
        },
      },
    ],
  },
})

serwist.addEventListeners()
