# AUI Map

An interactive, unofficial campus map for Al Akhawayn University. Every academic, administrative, athletic, and housing building, restaurant, shop, parking area, and special place, with photos, videos, contacts, and opening hours. Not owned, run, or endorsed by the university.

Live at [auimap.ma](https://auimap.ma).

<table>
<tr>
<th>Desktop</th>
<th>Mobile</th>
</tr>
<tr>
<td><img src="docs/screenshots/desktop-overview.jpg" height="360" alt="Desktop map view"></td>
<td><img src="docs/screenshots/mobile-overview.jpg" height="360" alt="Mobile map view"></td>
</tr>
<tr>
<td><img src="docs/screenshots/desktop-detail.jpg" height="360" alt="Desktop pin detail panel, the library"></td>
<td><img src="docs/screenshots/mobile-detail.jpg" height="360" alt="Mobile pin detail sheet, the library"></td>
</tr>
<tr>
<td><img src="docs/screenshots/zoomed-labels.jpg" height="360" alt="Pin labels appearing on zoom"></td>
<td><img src="docs/screenshots/filtering.jpg" height="360" alt="Filtering pins by tag"></td>
</tr>
<tr>
<td><img src="docs/screenshots/searching.jpg" height="360" alt="Searching for a pin"></td>
<td><img src="docs/screenshots/location.jpg" height="360" alt="Live location on the map"></td>
</tr>
</table>

## Features

- Pan/zoom campus map with tag-colored, searchable, filterable pins
- Pin detail panel with photos/videos, hours, contacts, links, and directions (Google Maps, Apple Maps, Waze)
- Live location with compass heading and a "center me" button, only ever on request, never a silent permission prompt
- Anyone can suggest edits or contribute photos to a pin. No account needed
- Installable PWA with offline support
- Admin dashboard to manage pins, tags, and incoming suggestions

## Stack

- [`Next.js`](https://nextjs.org/) 16 (App Router, Turbopack) · [`TypeScript`](https://www.typescriptlang.org/) 5 · [`React`](https://react.dev/) 19
- [`Prisma`](https://www.prisma.io/) 7 + Postgres (Neon), [`Vercel Blob`](https://vercel.com/docs/vercel-blob) for photo/video uploads
- [`Tailwind CSS`](https://tailwindcss.com/) 4 · [`shadcn`](https://ui.shadcn.com/) (Nova style, Neutral theme, Medium radius, [`Outfit`](https://fonts.google.com/specimen/Outfit) font) · [`Hugeicons`](https://hugeicons.com/)
- [`motion`](https://motion.dev/) for pin/panel animation, [`serwist`](https://serwist.pages.dev/) for the offline-capable PWA service worker
- [`Biome`](https://biomejs.dev/) · [`pnpm`](https://pnpm.io/)
