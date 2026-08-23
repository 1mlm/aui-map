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
  "Every academic, athletic, housing, and administrative building, restaurant, and service on Al Akhawayn University's campus. Complete with images, contacts, and offline mode."

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

// matches the manifest's background_color/theme_color — see src/app/manifest.ts
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
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
