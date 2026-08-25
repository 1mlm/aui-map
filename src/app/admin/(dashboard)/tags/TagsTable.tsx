"use client"

import { Suspense, useState } from "react"
import { Icon } from "@/components/Icon"
import { SearchBar } from "@/components/SearchBar"
import {
  CustomTable,
  type CustomTableColumn,
  type CustomTableEnumValue,
} from "@/components/table/CustomTable"
import { ICONS } from "@/icons"
import { CURATED_TAG_COLORS } from "@/map/tagColor"
import { Button } from "@/shadcn/ui/button"
import { type AdminTag, TagDialog } from "./TagDialog"

const colorOptions: Record<string, CustomTableEnumValue> = Object.fromEntries(
  CURATED_TAG_COLORS.map((name) => [
    name,
    { label: name, icon: ICONS.color, color: name },
  ]),
)

const emptyTag: AdminTag = {
  id: "",
  label: "",
  icon: "MoreIcon",
  color: null,
  sizeScale: 1,
  pinCount: 0,
}

function TagsTableInner({ tags }: { tags: AdminTag[] }) {
  const [resultCount, setResultCount] = useState(tags.length)
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null)
  const [creating, setCreating] = useState(false)

  const columns: CustomTableColumn<AdminTag>[] = [
    {
      id: "label",
      label: "Label",
      icon: ICONS.tag,
      type: "string",
      getString: (tag) => tag.label,
      onClick: (tag) => setEditingTag(tag),
    },
    {
      id: "id",
      label: "Id",
      icon: ICONS.id,
      type: "copy",
      getString: (tag) => tag.id,
    },
    {
      id: "color",
      label: "Color",
      icon: ICONS.color,
      type: "enum",
      enumOptions: colorOptions,
      getValue: (tag) => tag.color ?? undefined,
    },
    {
      id: "pins",
      label: "Pins",
      icon: ICONS.place,
      type: "string",
      align: "right",
      filterType: "number",
      getString: (tag) => String(tag.pinCount),
      getNumber: (tag) => tag.pinCount,
    },
    {
      id: "actions",
      label: "",
      icon: ICONS.edit,
      type: "buttons",
      getButtons: (tag) => (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full corner-squircle"
          onClick={() => setEditingTag(tag)}
        >
          <Icon icon={ICONS.edit} />
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <SearchBar
          className="flex-1"
          placeholder="Search tags..."
          trailing={`${resultCount} ${resultCount === 1 ? "tag" : "tags"}`}
        />
        <Button
          className="rounded-full corner-squircle"
          onClick={() => setCreating(true)}
        >
          <Icon icon={ICONS.add} />
          New tag
        </Button>
      </div>
      <CustomTable
        {...{ columns }}
        items={tags}
        getItemId={(tag) => tag.id}
        emptyLabel="tags"
        exportFilePrefix="tags"
        paginate={false}
        onVisibleCountChange={setResultCount}
      />

      {editingTag && (
        <TagDialog
          tag={editingTag}
          isNew={false}
          open={Boolean(editingTag)}
          onOpenChange={(open) => !open && setEditingTag(null)}
        />
      )}
      {creating && (
        <TagDialog
          tag={emptyTag}
          isNew={true}
          open={creating}
          onOpenChange={setCreating}
        />
      )}
    </div>
  )
}

export function TagsTable(props: { tags: AdminTag[] }) {
  return (
    <Suspense>
      <TagsTableInner {...props} />
    </Suspense>
  )
}
