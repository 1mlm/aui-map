import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // only feeds `prisma migrate`/CLI tooling — the app's own runtime connection (pooled,
  // via the driver adapter in src/utils/prisma.ts) is separate and unaffected by this.
  // Neon's docs recommend the unpooled url here since transaction-mode pgbouncer doesn't
  // hold migrate's advisory lock, but empirically the direct hostname just times out from
  // this environment while the pooled one has worked reliably all session — sticking with it
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
