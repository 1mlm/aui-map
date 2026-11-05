import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // only feeds `prisma migrate`/CLI tooling, the app's own runtime connection (pooled, via the
  // driver adapter in src/utils/prisma.ts) is separate and unaffected by this.
  // On Vercel, migrations must go over Neon's direct (unpooled) host: through the pooler, migrate's
  // advisory lock stays held by an idle pooled connection after the build ends and every later build
  // then times out waiting for it (P1002). Elsewhere (a laptop, the sandbox) the pooled url is kept,
  // the direct host has been unreachable from there
  datasource: {
    url: process.env.VERCEL
      ? (process.env.DATABASE_URL_UNPOOLED ??
        process.env.DATABASE_URL?.replace("-pooler", ""))
      : process.env.DATABASE_URL,
  },
})
