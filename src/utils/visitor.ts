const COOKIE_NAME = "aui_v"
const ONE_YEAR_S = 60 * 60 * 24 * 365

// a random id in a first-party cookie, so a returning visitor can be told from a new one. No ip, no
// fingerprinting, nothing leaves our own database. Cookies can be blocked, then every visit just
// counts as a new visitor
export function getVisitor(): { id: string; isNew: boolean } {
  try {
    const existing = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1)
    if (existing) return { id: existing, isNew: false }

    const id = crypto.randomUUID()
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and missing in Safari
    document.cookie = `${COOKIE_NAME}=${id}; max-age=${ONE_YEAR_S}; path=/; SameSite=Lax`
    return { id, isNew: true }
  } catch {
    return { id: "unknown", isNew: true }
  }
}
