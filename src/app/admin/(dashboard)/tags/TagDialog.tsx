"use client"

import { useState, useTransition } from "react"
import { DelayedButton } from "@/components/DelayedButton"
import { FieldLabel } from "@/components/FieldLabel"
import { FormDialog } from "@/components/FormDialog"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { ICON_REGISTRY, type IconName, resolveIcon } from "@/map/iconRegistry"
import { CURATED_TAG_COLORS, tagSolidColor } from "@/map/tagColor"
import { Input } from "@/shadcn/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/ui/select"
import { deleteTag, upsertTag } from "./actions"

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export type AdminTag = {
  id: string
  label: string
  icon: IconName
  color: string | null
  sizeScale: number
  pinCount: number
}

const INPUT_CLASS = "corner-squircle"
// only two tiers, not a free numeric range — a pin either reads as a building or as something
// smaller inside/next to one, so there's no real use case in between
const SMALL_PIN_SCALE = 0.8

export function TagDialog({
  tag,
  isNew,
  open,
  onOpenChange,
}: {
  tag: AdminTag
  isNew: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [id, setId] = useState(tag.id)
  const [idTouched, setIdTouched] = useState(!isNew)
  const [label, setLabel] = useState(tag.label)
  const [icon, setIcon] = useState<IconName>(tag.icon)
  const [color, setColor] = useState<string | null>(tag.color)
  const [sizeScale, setSizeScale] = useState(tag.sizeScale)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleLabelChange(value: string) {
    setLabel(value)
    if (!idTouched) setId(slugify(value))
  }

  function handleSave() {
    setError(null)
    if (!id || !label) {
      setError("Label and id are required.")
      return
    }
    startTransition(async () => {
      try {
        await upsertTag({ id, label, icon, color, sizeScale })
        onOpenChange(false)
      } catch {
        setError("Couldn't save — that id might already be in use.")
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteTag(id)
        onOpenChange(false)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't delete this tag.",
        )
      }
    })
  }

  return (
    <FormDialog
      {...{ open, error, pending }}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
      title={
        <span className="flex items-center gap-2">
          <Icon icon={isNew ? ICONS.add : ICONS.edit} />
          {isNew ? "New tag" : tag.label}
        </span>
      }
      description={
        isNew
          ? "Add a new tag category."
          : "Edit this tag's label, icon, and color."
      }
      onSubmit={handleSave}
      submitIcon={ICONS.save}
      submitLabel={isNew ? "Create tag" : "Save changes"}
      secondaryAction={
        !isNew && (
          <DelayedButton
            type="button"
            variant="destructive"
            className="rounded-full corner-squircle"
            waitSeconds={3}
            {...{ pending }}
            onClick={handleDelete}
          >
            <Icon icon={ICONS.delete} />
            Delete tag
          </DelayedButton>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.text} htmlFor="tag-label">
            Label
          </FieldLabel>
          <Input
            id="tag-label"
            placeholder="e.g. Academic"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.id} htmlFor="tag-id">
            Id
          </FieldLabel>
          <Input
            id="tag-id"
            placeholder="e.g. academic"
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
          <FieldLabel icon={resolveIcon(icon)} htmlFor="tag-icon">
            Icon
          </FieldLabel>
          <Select
            value={icon}
            onValueChange={(value) => setIcon(value as IconName)}
          >
            <SelectTrigger id="tag-icon" className={INPUT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(ICON_REGISTRY).map((name) => (
                <SelectItem key={name} value={name}>
                  <Icon icon={resolveIcon(name)} />
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Need a different icon? Add it to the app's icon registry first.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.color} htmlFor="tag-color">
            Color
          </FieldLabel>
          <Select
            value={color ?? "none"}
            onValueChange={(value) => setColor(value === "none" ? null : value)}
          >
            <SelectTrigger id="tag-color" className={INPUT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="size-3 rounded-full corner-squircle bg-muted" />
                None
              </SelectItem>
              {CURATED_TAG_COLORS.map((name) => (
                <SelectItem key={name} value={name}>
                  <span
                    className="size-3 rounded-full corner-squircle"
                    style={{ backgroundColor: tagSolidColor(name) }}
                  />
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel icon={ICONS.size} htmlFor="tag-size">
            Pin size
          </FieldLabel>
          <Select
            value={sizeScale === 1 ? "normal" : "small"}
            onValueChange={(value) =>
              setSizeScale(value === "small" ? SMALL_PIN_SCALE : 1)
            }
          >
            <SelectTrigger id="tag-size" className={INPUT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal — buildings</SelectItem>
              <SelectItem value="small">
                Small — sits inside/next to a building
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!isNew && tag.pinCount > 0 && (
          <p className="text-muted-foreground text-xs">
            Used by {tag.pinCount} pin{tag.pinCount > 1 ? "s" : ""}.
          </p>
        )}
      </div>
    </FormDialog>
  )
}
