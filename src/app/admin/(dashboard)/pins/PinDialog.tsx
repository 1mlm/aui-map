"use client"

import { useState, useTransition } from "react"
import { DelayedButton } from "@/components/DelayedButton"
import { FieldLabel } from "@/components/FieldLabel"
import { FormDialog } from "@/components/FormDialog"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { MAP_BOUNDING_BOX } from "@/map/geo"
import type { MapItemTag } from "@/map/types"
import { Input } from "@/shadcn/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shadcn/ui/select"
import { Textarea } from "@/shadcn/ui/textarea"
import { deletePin, upsertPin } from "./actions"
import { AttachmentManager, type AttachmentRow } from "./AttachmentManager"
import { PinPositionEditor } from "./PinPositionEditor"

export const MAP_CENTER = {
  latitude: (MAP_BOUNDING_BOX.topLat + MAP_BOUNDING_BOX.bottomLat) / 2,
  longitude: (MAP_BOUNDING_BOX.leftLong + MAP_BOUNDING_BOX.rightLong) / 2,
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export type AdminPin = {
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
  tagId: string
  attachments: AttachmentRow[]
}

const INPUT_CLASS = "corner-squircle"

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
  const [tagId, setTagId] = useState(pin.tagId)
  const [position, setPosition] = useState({ latitude: pin.latitude, longitude: pin.longitude })
  const [attachments, setAttachments] = useState(pin.attachments)
  const [idTouched, setIdTouched] = useState(!isNew)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
    startTransition(async () => {
      try {
        await upsertPin({
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
          ...position,
          tagId,
        })
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save — that id might already be in use.")
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
      description={isNew ? "Add a new pin to the map." : "Edit this pin's details, position, and photos."}
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
                await deletePin(id)
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
      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
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
              disabled={!isNew}
              onChange={(e) => {
                setIdTouched(true)
                setId(slugify(e.target.value))
              }}
              className={INPUT_CLASS}
            />
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
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ICONS.tag} htmlFor="pin-tag">
              Tag
            </FieldLabel>
            <Select value={tagId} onValueChange={setTagId}>
              <SelectTrigger id="pin-tag" className={INPUT_CLASS}>
                <SelectValue placeholder="Choose a tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              Overrides the maps menu's Google Maps option. Leave blank to just search these coordinates.
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

          {!isNew && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel icon={ICONS.photos}>Photos</FieldLabel>
              <AttachmentManager pinId={id} {...{ attachments }} onAttachmentsChange={setAttachments} />
            </div>
          )}
        </div>

        <PinPositionEditor {...position} onChange={setPosition} />
      </div>
    </FormDialog>
  )
}
