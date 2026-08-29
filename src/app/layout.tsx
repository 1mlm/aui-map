import { SerwistProvider } from "@serwist/turbopack/react"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata, Viewport } from "next"
import { Outfit } from "next/font/google"
import "@/shadcn/styles/globals.css"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import type { PropsWithChildren } from "react"
import { TooltipProvider } from "@/shadcn/ui/tooltip"

const outfit = Outfit()

const TITLE = "AUI Map"
const DESCRIPTION =
  "Every academic, administrative, athletic, and housing building, restaurant, shop, parking area, and special place on Al Akhawayn University's campus. Complete with photos, videos, contacts, and opening hours. Especially useful for finding the building you got assigned on the AUI portal (my.aui.ma)."

export const metadata: Metadata = {
  metadataBase: new URL("https://auimap.ma"),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  keywords: [
    "AUI Map",
    "Al Akhawayn University",
    "AUI campus map",
    "Ifrane",
    "Morocco university map",
    "interactive campus map",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "AUI Map",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    title: "AUI Map",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
}

// the manifest's background_color/theme_color (src/app/manifest.ts) can't be conditional, so the
// PWA splash screen always uses the dark value — this is what colors the live browser/OS chrome
// (installed PWA title bar, mobile status bar) once the app has actually loaded and follows system theme
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className={outfit.className}>
      <body className="antialiased">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
        >
          <NuqsAdapter>
            <TooltipProvider>{children}</TooltipProvider>
          </NuqsAdapter>
          <Analytics />
          <SpeedInsights />
        </SerwistProvider>
      </body>
    </html>
  )
}
