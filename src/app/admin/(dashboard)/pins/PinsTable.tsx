"use client"

import { Suspense, useState } from "react"
import { Icon } from "@/components/Icon"
import { SearchBar } from "@/components/SearchBar"
import { CustomTable, type CustomTableColumn, type CustomTableEnumValue } from "@/components/table/CustomTable"
import { ICONS } from "@/icons"
import { formatCoordinates } from "@/map/geo"
import type { MapItemTag } from "@/map/types"
import { Button } from "@/shadcn/ui/button"
import { type AdminPin, MAP_CENTER, PinDialog } from "./PinDialog"
import { PinPhotosDialog } from "./PinPhotosDialog"

const toTagEnumValue = (tag: MapItemTag): CustomTableEnumValue => ({
  label: tag.label,
  icon: tag.icon,
  color: tag.color ?? "gray",
})

const emptyPin = (tags: MapItemTag[]): AdminPin => ({
  id: "",
  title: "",
  aliases: [],
  description: null,
  mapsUrl: null,
  hours: null,
  ramadanHours: null,
  phone: null,
  email: null,
  ...MAP_CENTER,
  tagId: tags[0]?.id ?? "",
  attachments: [],
})

function PinsTableInner({ pins, tags }: { pins: AdminPin[]; tags: MapItemTag[] }) {
  const [resultCount, setResultCount] = useState(pins.length)
  const [editingPin, setEditingPin] = useState<AdminPin | null>(null)
  const [creating, setCreating] = useState(false)
  const [viewingPhotosOf, setViewingPhotosOf] = useState<AdminPin | null>(null)

  const tagOptions = Object.fromEntries(tags.map((tag) => [tag.id, toTagEnumValue(tag)]))

  const columns: CustomTableColumn<AdminPin>[] = [
    {
      id: "title",
      label: "Title",
      icon: ICONS.place,
      type: "string",
      getString: (pin) => pin.title,
      onClick: (pin) => setEditingPin(pin),
    },
    {
      id: "id",
      label: "Id",
      icon: ICONS.id,
      type: "copy",
      getString: (pin) => pin.id,
    },
    {
      id: "tag",
      label: "Tag",
      icon: ICONS.tag,
      type: "enum",
      enumOptions: tagOptions,
      getValue: (pin) => pin.tagId,
    },
    {
      id: "aliases",
      label: "Aliases",
      icon: ICONS.aliases,
      type: "tags",
      getTags: (pin) => pin.aliases.map((alias) => ({ label: alias, icon: ICONS.aliases, color: "gray" })),
    },
    {
      id: "coordinates",
      label: "Coordinates",
      icon: ICONS.target,
      type: "copy",
      getString: (pin) => formatCoordinates(pin),
    },
    {
      id: "attachments",
      label: "Photos",
      icon: ICONS.photos,
      type: "buttons",
      getButtons: (pin) =>
        pin.attachments.length === 0 ? (
          <Icon icon={ICONS.clear} className="mx-auto text-muted-foreground/50" />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full corner-squircle"
            onClick={() => setViewingPhotosOf(pin)}
          >
            <Icon icon={ICONS.photo} />
            {pin.attachments.length}
          </Button>
        ),
    },
    {
      id: "actions",
      label: "",
      icon: ICONS.edit,
      type: "buttons",
      getButtons: (pin) => (
        <Button variant="ghost" size="sm" className="rounded-full corner-squircle" onClick={() => setEditingPin(pin)}>
          <Icon icon={ICONS.edit} />
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <SearchBar className="flex-1" placeholder="Search pins..." trailing={`${resultCount} ${resultCount === 1 ? "pin" : "pins"}`} />
        <Button className="rounded-full corner-squircle" onClick={() => setCreating(true)}>
          <Icon icon={ICONS.add} />
          New pin
        </Button>
      </div>
      <CustomTable
        {...{ columns }}
        items={pins}
        getItemId={(pin) => pin.id}
        emptyLabel="pins"
        exportFilePrefix="pins"
        onVisibleCountChange={setResultCount}
      />

      {editingPin && (
        <PinDialog
          pin={editingPin}
          isNew={false}
          open={Boolean(editingPin)}
          onOpenChange={(open) => !open && setEditingPin(null)}
          {...{ tags }}
        />
      )}
      {creating && (
        <PinDialog
          pin={emptyPin(tags)}
          isNew={true}
          open={creating}
          onOpenChange={setCreating}
          {...{ tags }}
        />
      )}
      {viewingPhotosOf && (
        <PinPhotosDialog
          pinId={viewingPhotosOf.id}
          pinTitle={viewingPhotosOf.title}
          attachments={viewingPhotosOf.attachments}
          open={Boolean(viewingPhotosOf)}
          onOpenChange={(open) => !open && setViewingPhotosOf(null)}
        />
      )}
    </div>
  )
}

export function PinsTable(props: { pins: AdminPin[]; tags: MapItemTag[] }) {
  return (
    <Suspense>
      <PinsTableInner {...props} />
    </Suspense>
  )
}
