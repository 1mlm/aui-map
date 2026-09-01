import type { Metadata } from "next"
import { prisma } from "@/utils/prisma"
import type { SuggestionRow } from "./SuggestionsTable"
import { SuggestionsTable } from "./SuggestionsTable"

export const metadata: Metadata = { title: "Feedback" }

export default async function AdminSuggestionsPage() {
  const suggestionRows = await prisma.suggestion.findMany({
    orderBy: { submittedAt: "desc" },
  })

  const suggestions: SuggestionRow[] = suggestionRows.map((suggestion) => ({
    id: suggestion.id,
    kind: suggestion.kind,
    message: suggestion.message,
    fileUrl: suggestion.fileUrl,
    fileName: suggestion.fileName,
    mimeType: suggestion.mimeType,
    submittedAt: suggestion.submittedAt.toISOString(),
    resolved: suggestion.resolved,
  }))

  return <SuggestionsTable {...{ suggestions }} />
}
