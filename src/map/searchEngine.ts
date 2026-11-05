// How the search bar understands people. Plain logic, no UI: given what someone typed and the places
// on the map, it says which places to offer, best first, and why. It is forgiving on purpose: typos
// ("libray"), plain words ("hungry", "pray", "printer"), building numbers ("b 8", "building 8", "8"),
// categories ("food") and French basics all land somewhere useful, because the people using the map
// are not going to learn how to search it.

export type Searchable = {
  id: string
  title: string
  aliases: string[]
  // hidden words for this place, edited in the admin ("doctor", "sick" for the health center)
  keywords?: string[]
  tag: { id: string; label: string; keywords?: string[] }
}

export type SearchMode =
  // nothing typed
  | "empty"
  // the place itself: its name, number or alias
  | "places"
  // found through a hidden keyword or a category word ("doctor", "food"), not through a name
  | "concept"
  // nothing matched exactly, these are the closest names
  | "fuzzy"
  // nothing at all
  | "none"

export type SearchHit<T> = { item: T; score: number }

export type SearchOutcome<T> = {
  mode: SearchMode
  hits: SearchHit<T>[]
}

// ---- normalising ----
export function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}
const words = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

// words people put in front of a name out of habit: "aui b8", "akhawayn library", "the library"
const FILLER = new Set([
  "aui",
  "akhawayn",
  "alakhawayn",
  "university",
  "al",
  "the",
  "a",
  "an",
  "to",
  "go",
  "where",
  "is",
  "are",
  "can",
  "i",
  "find",
  "near",
  "nearest",
  "closest",
  "building",
  "bldg",
  "campus",
  "of",
  "for",
  "me",
  "my",
  "in",
  "at",
  "le",
  "la",
  "les",
  "du",
  "de",
  "ou",
  "est",
])

// ---- typo tolerance ----
// Damerau-Levenshtein (a swapped pair of letters counts as one mistake)
function distance(a: string, b: string) {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array(cols - 1).fill(0),
  ])
  for (let j = 0; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++)
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[rows - 1][cols - 1]
}
// how many mistakes a word of that length may have and still count as "meant that"
const allowedMistakes = (length: number) =>
  length <= 3 ? 0 : length <= 6 ? 1 : 2

// ---- the search ----
// the keys one place can be found by, with how good a match each one is
function keysOf(item: Searchable) {
  return {
    id: normalizeForSearch(item.id),
    title: normalizeForSearch(item.title),
    aliases: item.aliases.filter(Boolean).map(normalizeForSearch),
    tag: normalizeForSearch(item.tag.label),
    keywords: (item.keywords ?? []).map(normalizeForSearch).filter(Boolean),
    tagKeywords: (item.tag.keywords ?? [])
      .map(normalizeForSearch)
      .filter(Boolean),
    allWords: [
      ...words(item.title),
      ...item.aliases.flatMap(words),
      ...words(item.id),
    ],
  }
}

export function searchPlaces<T extends Searchable>(
  rawQuery: string,
  items: T[],
): SearchOutcome<T> {
  const query = rawQuery.trim()
  if (!query) return { mode: "empty", hits: [] }

  const tokens = words(query).filter((token) => !FILLER.has(token))
  // all filler ("aui", "where is the"): treat what was typed as it is
  const queryWords = tokens.length ? tokens : words(query)
  const whole = normalizeForSearch(queryWords.join(""))
  if (!whole) return { mode: "none", hits: [] }
  // "b 8", "b8", "building 8", "8" all mean the same building
  const numberKeys: string[] = []
  const digits = whole.match(/^b?(\d{1,3})$/)
  if (digits) numberKeys.push(`b${digits[1]}`, digits[1])

  const keyed = items.map((item) => ({ item, keys: keysOf(item) }))
  const asked = new Set(queryWords)
  const askedKeys = [...asked].map(normalizeForSearch)

  // places found by a hidden word, the strongest being a word of the place itself, then its category's
  const matchesKeyword = (list: string[], key: string) =>
    list.some(
      (word) => word === key || (key.length >= 3 && word.startsWith(key)),
    )
  const concept = (() => {
    const found: SearchHit<T>[] = []
    for (const { item, keys } of keyed) {
      const own = askedKeys.some((key) => matchesKeyword(keys.keywords, key))
      const byTag = askedKeys.some(
        (key) =>
          matchesKeyword(keys.tagKeywords, key) ||
          (key.length >= 3 && (keys.tag === key || keys.tag.startsWith(key))),
      )
      if (own) found.push({ item, score: 65 })
      else if (byTag) found.push({ item, score: 55 })
    }
    return found.length ? { hits: found } : null
  })()
  const byName = (a: SearchHit<T>, b: SearchHit<T>) =>
    b.score - a.score || a.item.title.localeCompare(b.item.title)

  const placeScores = new Map<T, number>()
  const bump = (item: T, score: number) =>
    placeScores.set(item, Math.max(placeScores.get(item) ?? 0, score))
  for (const { item, keys } of keyed) {
    // the place itself, best matches first
    if (numberKeys.includes(keys.id) || numberKeys.includes(keys.title))
      bump(item, 100)
    if (keys.id === whole || keys.title === whole) bump(item, 98)
    if (keys.aliases.includes(whole)) bump(item, 95)
    if (keys.title.startsWith(whole) || keys.id.startsWith(whole))
      bump(item, whole.length >= 2 ? 85 : 40)
    if (keys.aliases.some((alias) => alias.startsWith(whole))) bump(item, 80)
    // every typed word found somewhere in the names, in any order ("health center", "center health")
    {
      const haystack = [keys.id, keys.title, ...keys.aliases]
      const each = queryWords.map(normalizeForSearch)
      if (each.every((word) => haystack.some((value) => value.includes(word))))
        // a short single word inside another word ("eat" in "amphitheater") is a weak match
        bump(item, queryWords.length > 1 || whole.length >= 5 ? 70 : 50)
    }
  }
  const placeHits = [...placeScores].map(([item, score]) => ({ item, score }))
  const bestPlace = Math.max(0, ...placeHits.map((h) => h.score))

  if (concept && bestPlace < 70) {
    // a need ("eat", "doctor"): only weak look-alikes inside other words ("eat" in "amphitheater") lose to it
    return { mode: "concept", hits: concept.hits.sort(byName) }
  }
  if (placeHits.length) {
    // a clear place, plus the rest of its group underneath ("club": the club house, then the clubs office)
    const known = new Set(placeHits.map((h) => h.item))
    const extra = concept
      ? concept.hits
          .filter((h) => !known.has(h.item))
          .map((h) => ({ item: h.item, score: Math.min(h.score, 50) }))
      : []
    return {
      mode: "places",
      hits: [...placeHits.sort(byName), ...extra.sort(byName)],
    }
  }

  // nothing exact: the closest spellings
  const fuzzy = new Map<T, number>()
  for (const key of askedKeys) {
    if (key.length < 3) continue
    const allowed = allowedMistakes(key.length)
    for (const { item, keys } of keyed) {
      let best = Number.POSITIVE_INFINITY
      for (const word of [...keys.allWords, keys.title, ...keys.aliases]) {
        const w = normalizeForSearch(word)
        if (Math.abs(w.length - key.length) > allowed) continue
        best = Math.min(best, distance(key, w))
      }
      if (best <= allowed)
        fuzzy.set(item, Math.max(fuzzy.get(item) ?? 0, 40 - best * 5))
    }
    // a misspelled hidden word: "docter", "hungary"
    for (const { item, keys } of keyed) {
      for (const word of [...keys.keywords, ...keys.tagKeywords]) {
        if (
          word.length < 4 ||
          Math.abs(word.length - key.length) > allowed ||
          distance(key, word) > allowed
        )
          continue
        fuzzy.set(item, Math.max(fuzzy.get(item) ?? 0, 35))
      }
    }
  }
  if (fuzzy.size) {
    const hits = [...fuzzy].map(([item, score]) => ({ item, score }))
    hits.sort(
      (a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title),
    )
    return { mode: "fuzzy", hits: hits.slice(0, 8) }
  }
  return { mode: "none", hits: [] }
}
