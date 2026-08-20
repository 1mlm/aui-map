import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "@/shadcn/styles/globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";
import { TooltipProvider } from "@/shadcn/ui/tooltip";

const outfit = Outfit();

export const metadata: Metadata = {
  title: "AUI Map",
  description: "Interactive campus map for Al Akhawayn University.",
  appleWebApp: {
    title: "AUI Map",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

// matches the manifest's background_color/theme_color — see src/app/manifest.ts
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className={outfit.className}>
      <body className="antialiased">
        <NuqsAdapter>
          <TooltipProvider>{children}</TooltipProvider>
        </NuqsAdapter>
        <Analytics />
      </body>
    </html>
  );
}
