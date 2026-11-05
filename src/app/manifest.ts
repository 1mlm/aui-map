import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AUI Map",
    short_name: "AUI Map",
    description: "Interactive campus map for Al Akhawayn University.",
    id: "/",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // desktop Chrome falls back to a minimal window if standalone is somehow unavailable
    display_override: ["standalone", "minimal-ui"],
    categories: ["education", "navigation", "maps"],
    // tapping the icon again focuses the already open app instead of stacking a second window
    launch_handler: { client_mode: "navigate-existing" },
    // long-press the home screen icon: straight to the places people look for most
    shortcuts: [
      { name: "Library", url: "/m6l" },
      { name: "Cafeteria", url: "/cossa" },
      { name: "Health Center", url: "/health-center" },
      { name: "Main Gate", url: "/main-gate" },
    ],
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
