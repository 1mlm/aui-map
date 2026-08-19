import { prisma } from "@/utils/prisma"
import type { SuggestionRow } from "./SuggestionsTable"
import { SuggestionsTable } from "./SuggestionsTable"

export default async function AdminSuggestionsPage() {
  const suggestionRows = await prisma.suggestion.findMany({ orderBy: { submittedAt: "desc" } })

  const suggestions: SuggestionRow[] = suggestionRows.map((suggestion) => ({
    id: suggestion.id,
    message: suggestion.message,
    submittedAt: suggestion.submittedAt.toISOString(),
    resolved: suggestion.resolved,
  }))

  return <SuggestionsTable {...{ suggestions }} />
}
