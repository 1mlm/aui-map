"use client"

import { useState, useTransition } from "react"
import { DelayedButton } from "@/components/DelayedButton"
import { Disclosure } from "@/components/Disclosure"
import { FieldLabel } from "@/components/FieldLabel"
import { FormDialog } from "@/components/FormDialog"
import { Icon } from "@/components/Icon"
import { EnumBadge } from "@/components/table/CustomTableCell"
import { ICONS } from "@/icons"
import type { MapItemTag, PinLink } from "@/map/types"
import { Button } from "@/shadcn/ui/button"
import { Checkbox } from "@/shadcn/ui/checkbox"
import { Input } from "@/shadcn/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select"
import { Textarea } from "@/shadcn/ui/textarea"
import { AttachmentManager, type AttachmentRow } from "./AttachmentManager"
import { deletePin, upsertPin } from "./actions"
import { PinPositionEditor } from "./PinPositionEditor"

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export type AdminPin = {
  // null for a pin that hasn't been created yet
  uuid: string | null
  id: string
  title: string
  aliases: string[]
  description: string | null
  latitude: number
  longitude: number
  mapsUrl: string | null
  hours: string | null
  ramadanHours: string | null
  phone: string | null
  email: string | null
  links: PinLink[]
  tagId: string
  underConstruction: boolean
  attachments: AttachmentRow[]
}

const INPUT_CLASS = "corner-squircle"

// a client-only key so React can track each row across edits/deletes — PinLink itself has
// no stable id, and label+url alone isn't unique while a row is still being typed into
type EditableLink = PinLink & { key: string }

function LinksEditor({
  links,
  onChange,
}: {
  links: EditableLink[]
  onChange: (links: EditableLink[]) => void
}) {
  function updateLink(key: string, patch: Partial<PinLink>) {
    onChange(
      links.map((link) => (link.key === key ? { ...link, ...patch } : link)),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {links.map((link) => (
        <div key={link.key} className="flex items-center gap-2">
          <Input
            placeholder="Label, e.g. Instagram"
            value={link.label}
            onChange={(e) => updateLink(link.key, { label: e.target.value })}
            className={`${INPUT_CLASS} flex-1`}
          />
          <Input
            placeholder="https://…"
            value={link.url}
            onChange={(e) => updateLink(link.key, { url: e.target.value })}
            className={`${INPUT_CLASS} flex-[2]`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full corner-squircle"
            onClick={() => onChange(links.filter((l) => l.key !== link.key))}
            aria-label="Remove link"
          >
            <Icon icon={ICONS.delete} className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start rounded-full corner-squircle"
        onClick={() =>
          onChange([...links, { key: crypto.randomUUID(), label: "", url: "" }])
        }
      >
        <Icon icon={ICONS.add} />
        Add link
      </Button>
    </div>
  )
}

export function PinDialog({
  pin,
  tags,
  isNew,
  open,
  onOpenChange,
}: {
  pin: AdminPin
  tags: MapItemTag[]
  isNew: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [id, setId] = useState(pin.id)
  const [title, setTitle] = useState(pin.title)
  const [aliasesText, setAliasesText] = useState(pin.aliases.join(", "))
  const [description, setDescription] = useState(pin.description ?? "")
  const [mapsUrl, setMapsUrl] = useState(pin.mapsUrl ?? "")
  const [hours, setHours] = useState(pin.hours ?? "")
  const [ramadanHours, setRamadanHours] = useState(pin.ramadanHours ?? "")
  const [phone, setPhone] = useState(pin.phone ?? "")
  const [email, setEmail] = useState(pin.email ?? "")
  const [links, setLinks] = useState<EditableLink[]>(
    pin.links.map((link) => ({ ...link, key: crypto.randomUUID() })),
  )
  const [tagId, setTagId] = useState(pin.tagId)
  const [underConstruction, setUnderConstruction] = useState(
    pin.underConstruction,
  )
  const [position, setPosition] = useState({
    latitude: pin.latitude,
    longitude: pin.longitude,
  })
  const [attachments, setAttachments] = useState(pin.attachments)
  const [idTouched, setIdTouched] = useState(!isNew)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const selectedTag = tags.find((tag) => tag.id === tagId)

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!idTouched) setId(slugify(value))
  }

  function handleSave() {
    setError(null)
    if (!id || !title || !tagId) {
      setError("Title, id, and tag are required.")
      return
    }
    if (Number.isNaN(position.latitude) || Number.isNaN(position.longitude)) {
      setError("Latitude and longitude are required.")
      return
    }
    startTransition(async () => {
      try {
        await upsertPin({
          uuid: pin.uuid,
          id,
          title,
          aliases: aliasesText
            .split(",")
            .map((alias) => alias.trim())
            .filter(Boolean),
          description: description || null,
          mapsUrl: mapsUrl.trim() || null,
          hours: hours.trim() || null,
          ramadanHours: ramadanHours.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          links: links
            .map(({ label, url }) => ({ label: label.trim(), url: url.trim() }))
            .filter((link) => link.label && link.url),
          ...position,
          tagId,
          underConstruction,
        })
        onOpenChange(false)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't save — that id might already be in use.",
        )
      }
    })
  }

  return (
    <FormDialog
      {...{ open, onOpenChange, pending, error }}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
      title={
        <span className="flex items-center gap-2">
          <Icon icon={isNew ? ICONS.add : ICONS.edit} />
          {isNew ? "New pin" : pin.title}
        </span>
      }
      description={
        isNew
          ? "Add a new pin to the map."
          : "Edit this pin's details, position, and photos."
      }
      onSubmit={handleSave}
      submitIcon={ICONS.save}
      submitLabel={isNew ? "Create pin" : "Save changes"}
      className="sm:max-w-2xl"
      secondaryAction={
        !isNew && (
          <DelayedButton
            type="button"
            variant="destructive"
            className="rounded-full corner-squircle"
            waitSeconds={3}
            {...{ pending }}
            onClick={() =>
              startTransition(async () => {
                if (!pin.uuid) return
                await deletePin(pin.uuid)
                onOpenChange(false)
              })
            }
          >
            <Icon icon={ICONS.delete} />
            Delete pin
          </DelayedButton>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.text} htmlFor="pin-title">
            Title
          </FieldLabel>
          <Input
            id="pin-title"
            placeholder="e.g. Mohammed VI Library"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.id} htmlFor="pin-id">
            Id (used in ?focus= links)
          </FieldLabel>
          <Input
            id="pin-id"
            placeholder="e.g. m6l"
            value={id}
            onChange={(e) => {
              setIdTouched(true)
              setId(slugify(e.target.value))
            }}
            className={INPUT_CLASS}
          />
          {!isNew && (
            <p className="text-muted-foreground text-xs">
              Renaming this breaks any ?focus= link already pointing at the old
              id.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.aliases} htmlFor="pin-aliases">
            Aliases
          </FieldLabel>
          <Input
            id="pin-aliases"
            placeholder="e.g. M6L, The Library"
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.description} htmlFor="pin-description">
            Description
          </FieldLabel>
          <Textarea
            id="pin-description"
            placeholder="A short blurb shown in the pin's detail panel"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </div>
        <PinPositionEditor {...position} onChange={setPosition} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.tag} htmlFor="pin-tag">
            Tag
          </FieldLabel>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger id="pin-tag" className={INPUT_CLASS}>
              <SelectValue placeholder="Choose a tag">
                {selectedTag && (
                  <EnumBadge
                    value={{
                      label: selectedTag.label,
                      icon: selectedTag.icon,
                      color: selectedTag.color ?? "gray",
                    }}
                  />
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <EnumBadge
                    value={{
                      label: tag.label,
                      icon: tag.icon,
                      color: tag.color ?? "gray",
                    }}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isNew && pin.uuid && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ICONS.photos}>Photos</FieldLabel>
            <AttachmentManager
              pinId={pin.uuid}
              {...{ attachments }}
              onAttachmentsChange={setAttachments}
            />
          </div>
        )}

        <Disclosure label="Show additional options">
          <label
            htmlFor="pin-under-construction"
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              id="pin-under-construction"
              checked={underConstruction}
              onCheckedChange={(checked) =>
                setUnderConstruction(checked === true)
              }
            />
            <Icon
              icon={ICONS.construction}
              className="size-4 text-muted-foreground"
            />
            In construction
          </label>
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ICONS.openExternalMap} htmlFor="pin-maps-url">
              Google Maps link (optional)
            </FieldLabel>
            <Input
              id="pin-maps-url"
              placeholder="Paste a Google Maps place link for reviews & photos"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="text-muted-foreground text-xs">
              Overrides the maps menu's Google Maps option. Leave blank to just
              search these coordinates.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ICONS.clock} htmlFor="pin-hours">
              Hours (optional)
            </FieldLabel>
            <Input
              id="pin-hours"
              placeholder="e.g. Mon-Thu 8am-12am, Fri 8am-6pm"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ICONS.ramadan} htmlFor="pin-ramadan-hours">
              Ramadan hours (optional)
            </FieldLabel>
            <Input
              id="pin-ramadan-hours"
              placeholder="Leave blank if hours don't change during Ramadan"
              value={ramadanHours}
              onChange={(e) => setRamadanHours(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel icon={ICONS.phone} htmlFor="pin-phone">
                Phone (optional)
              </FieldLabel>
              <Input
                id="pin-phone"
                placeholder="e.g. +212 535 86 2170"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel icon={ICONS.email} htmlFor="pin-email">
                Email (optional)
              </FieldLabel>
              <Input
                id="pin-email"
                type="email"
                placeholder="e.g. healthcenter@aui.ma"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ICONS.link}>Links (optional)</FieldLabel>
            <LinksEditor {...{ links }} onChange={setLinks} />
          </div>
        </Disclosure>
      </div>
    </FormDialog>
  )
}
