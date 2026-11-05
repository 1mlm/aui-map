import { prisma } from "@/utils/prisma"

// friendly names for the referrers that actually show up. Anything else falls back to its host
const SOURCE_BY_HOST: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|^l\.messenger\.com$/, "facebook"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, "x"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)discord\.com$|^discord\.gg$/, "discord"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)sharepoint\.com$/, "sharepoint"],
  [/^my\.aui\.ma$/, "aui portal"],
  [/(^|\.)aui\.ma$/, "aui website"],
  [/(^|\.)outlook\.(live|office)\.com$|^mail\.google\.com$/, "email"],
]
const OWN_HOSTS = /(^|\.)auimap\.ma$|^localhost$/
const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i

function resolveSource(tag: unknown, refHost: unknown, standalone: unknown) {
  // a tag on the link ("?s=poster") always wins, it's the most precise thing there is
  if (typeof tag === "string" && /^[\w-]{1,30}$/.test(tag))
    return tag.toLowerCase()
  if (standalone === true) return "installed app"
  if (typeof refHost !== "string" || !refHost) return "direct"
  const host = refHost
    .toLowerCase()
    .replace(/^www\./, "")
    .slice(0, 100)
  if (OWN_HOSTS.test(host)) return "direct"
  return SOURCE_BY_HOST.find(([pattern]) => pattern.test(host))?.[1] ?? host
}

export async function POST(request: Request) {
  if (BOT.test(request.headers.get("user-agent") ?? ""))
    return new Response(null, { status: 204 })

  try {
    const body = await request.json()
    const path = String(body.path ?? "").slice(0, 200)
    const visitorId = String(body.vid ?? "").slice(0, 64)
    if (!path.startsWith("/") || path.startsWith("/admin") || !visitorId)
      return new Response(null, { status: 204 })

    await prisma.pageView.create({
      data: {
        path,
        visitorId,
        isNew: body.isNew === true,
        source: resolveSource(body.s, body.ref, body.standalone),
      },
    })
  } catch {
    // a lost page view is never worth an error
  }
  return new Response(null, { status: 204 })
}
