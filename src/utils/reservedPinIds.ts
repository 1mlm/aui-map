// a pin's public `id` is what gets shared as a link (auimap.ma/#<id>) — words that read as
// app sections rather than a place are rejected as pin slugs to avoid confusing links
export const RESERVED_PIN_IDS = new Set([
  "admin",
  "api",
  "debug",
  "serwist",
  "~offline",
  "m",
  "map",
  "search",
  "filter",
  "share",
  "qr",
  "login",
])
