"use client"

import { Suspense, useState, useTransition } from "react"
import { DelayedButton } from "@/components/DelayedButton"
import { Icon } from "@/components/Icon"
import { SearchBar } from "@/components/SearchBar"
import {
  CustomTable,
  type CustomTableColumn,
} from "@/components/table/CustomTable"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import { deleteSuggestion, setSuggestionResolved } from "./actions"

export type SuggestionRow = {
  id: string
  message: string
  submittedAt: string
  resolved: boolean
}

function SuggestionRowActions({ suggestion }: { suggestion: SuggestionRow }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full corner-squircle"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            setSuggestionResolved(suggestion.id, !suggestion.resolved),
          )
        }
      >
        <Icon icon={suggestion.resolved ? ICONS.reopen : ICONS.check} />
        {suggestion.resolved ? "Reopen" : "Resolve"}
      </Button>
      <DelayedButton
        variant="ghost"
        size="sm"
        className="rounded-full corner-squircle text-destructive hover:text-destructive"
        waitSeconds={2}
        {...{ pending }}
        onClick={() => startTransition(() => deleteSuggestion(suggestion.id))}
      >
        <Icon icon={ICONS.delete} />
      </DelayedButton>
    </div>
  )
}

function SuggestionsTableInner({
  suggestions,
}: {
  suggestions: SuggestionRow[]
}) {
  const [resultCount, setResultCount] = useState(suggestions.length)

  const columns: CustomTableColumn<SuggestionRow>[] = [
    {
      id: "message",
      label: "Message",
      icon: ICONS.message,
      type: "string",
      getString: (suggestion) => suggestion.message,
    },
    {
      id: "submittedAt",
      label: "Submitted",
      icon: ICONS.clock,
      type: "date",
      getDate: (suggestion) => new Date(suggestion.submittedAt),
    },
    {
      id: "resolved",
      label: "Resolved",
      icon: ICONS.check,
      type: "boolean",
      getBoolean: (suggestion) => suggestion.resolved,
    },
    {
      id: "actions",
      label: "",
      icon: ICONS.moreActions,
      type: "buttons",
      getButtons: (suggestion) => <SuggestionRowActions {...{ suggestion }} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <SearchBar
        placeholder="Search suggestions..."
        trailing={`${resultCount} ${resultCount === 1 ? "suggestion" : "suggestions"}`}
      />
      <CustomTable
        {...{ columns }}
        items={suggestions}
        getItemId={(suggestion) => suggestion.id}
        emptyLabel="suggestions"
        exportFilePrefix="suggestions"
        paginate={false}
        onVisibleCountChange={setResultCount}
      />
    </div>
  )
}

export function SuggestionsTable(props: { suggestions: SuggestionRow[] }) {
  return (
    <Suspense>
      <SuggestionsTableInner {...props} />
    </Suspense>
  )
}
