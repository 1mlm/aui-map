import { spawnSync } from "node:child_process"
import { createSerwistRoute } from "@serwist/turbopack"

// ties the offline fallback's cache entry to the current commit, so a deploy invalidates it
// instead of visitors being stuck with a stale fallback page forever
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ||
  crypto.randomUUID()

// builds public/sw.js at /serwist/sw.js — see src/app/sw.ts for the actual caching logic, and
// SerwistProvider in src/app/layout.tsx for where the browser is told to register it
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
  })
