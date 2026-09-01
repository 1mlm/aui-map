"use client"

import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shadcn/ui/dropdown-menu"
import { copyImageToClipboard } from "@/utils/clipboard"
import { triggerHaptic } from "@/utils/haptics"
import { useCopyFeedback } from "@/utils/useCopyFeedback"
import { QrCodePreview } from "./QrCodePreview"
import { qrCodeOptions } from "./qrCodeOptions"

const COPIED_FEEDBACK_MS = 1500
const QR_PNG_SIZE = 512

async function renderQrCodePng(url: string): Promise<Blob | null> {
  const { default: QRCodeStyling } = await import("qr-code-styling")
  const qrCode = new QRCodeStyling(qrCodeOptions(url, QR_PNG_SIZE))
  const raw = await qrCode.getRawData("png")
  return raw instanceof Blob ? raw : null
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function ShareMenu({
  pinId,
  pinTitle,
}: {
  pinId: string
  pinTitle: string
}) {
  const [qrCodeOpen, setQrCodeOpen] = useState(false)
  const [imageFeedback, setImageFeedback] = useState<
    "copied" | "downloaded" | null
  >(null)
  const { copied: linkCopied, copy: copyLink } =
    useCopyFeedback(COPIED_FEEDBACK_MS)

  function getPinLink() {
    return new URL(`/#${pinId}`, window.location.origin).toString()
  }

  function flashImageFeedback(kind: "copied" | "downloaded") {
    setImageFeedback(kind)
    setTimeout(() => setImageFeedback(null), COPIED_FEEDBACK_MS)
  }

  async function handleShare() {
    triggerHaptic()
    const link = getPinLink()
    if (navigator.share) {
      try {
        await navigator.share({ title: pinTitle, url: link })
      } catch {
        // user dismissed the native share sheet — not a failure worth surfacing
      }
      return
    }
    const succeeded = await copyLink(link)
    if (succeeded) triggerHaptic("success")
  }

  function handleOpenQrCode() {
    triggerHaptic()
    setQrCodeOpen(true)
  }

  async function handleCopyImage() {
    triggerHaptic()
    const blob = await renderQrCodePng(getPinLink())
    if (!blob) return
    const succeeded = await copyImageToClipboard(blob)
    if (succeeded) {
      flashImageFeedback("copied")
      triggerHaptic("success")
    }
  }

  async function handleDownload() {
    triggerHaptic()
    const blob = await renderQrCodePng(getPinLink())
    if (!blob) return
    downloadBlob(blob, `${pinId}-qrcode.png`)
    flashImageFeedback("downloaded")
    triggerHaptic("success")
  }

  async function handleShareImage() {
    triggerHaptic()
    const blob = await renderQrCodePng(getPinLink())
    if (!blob) return
    const file = new File([blob], `${pinId}-qrcode.png`, {
      type: "image/png",
    })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: pinTitle })
      } catch {
        // dismissed
      }
      return
    }
    // desktop browsers mostly can't share files — fall back to copying the image instead
    const succeeded = await copyImageToClipboard(blob)
    if (succeeded) {
      flashImageFeedback("copied")
      triggerHaptic("success")
    }
  }

  // one control instead of two: the QRCode used to sit in the panel as its own button, which
  // spent a permanent slot on the rarest of the three things you can do with a pin's link
  const shareActions = [
    {
      id: "qrcode",
      icon: ICONS.qrCode,
      label: "Generate QRCode",
      onSelect: handleOpenQrCode,
    },
    {
      id: "copy",
      icon: linkCopied ? ICONS.copied : ICONS.copy,
      label: linkCopied ? "Link copied!" : "Copy link",
      onSelect: () => {
        triggerHaptic()
        copyLink(getPinLink())
      },
    },
    {
      id: "export",
      icon: ICONS.share,
      label: "Export link",
      onSelect: handleShare,
    },
  ]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Share this place"
            className="flex cursor-pointer items-center gap-0.5 rounded-full corner-squircle bg-white/10 px-2 py-2 text-white transition-colors hover:bg-white/20"
          >
            <Icon icon={linkCopied ? ICONS.copied : ICONS.share} />
            <Icon icon={ICONS.dropdown} className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {shareActions.map(({ id, icon, label, onSelect }) => (
            <DropdownMenuItem key={id} className="cursor-pointer" {...{ onSelect }}>
              <Icon {...{ icon }} />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
        <DialogContent className="flex w-auto flex-col items-center gap-3">
          <DialogTitle>{pinTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            QRCode for {pinTitle}
          </DialogDescription>

          {/* qrCodeOpen-gated, not just left to Dialog's own mount logic — getPinLink() touches
          window.location, and JSX children evaluate in this component's render regardless of
          whether DialogContent ends up mounting them, which would crash during SSR */}
          {qrCodeOpen && (
            <>
              <QrCodePreview url={getPinLink()} />
              <span className="max-w-64 text-center text-xs break-all text-muted-foreground">
                {getPinLink()}
              </span>
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full corner-squircle"
                  onClick={handleCopyImage}
                >
                  <Icon
                    icon={
                      imageFeedback === "copied" ? ICONS.copied : ICONS.copy
                    }
                  />
                  Copy Image
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-full corner-squircle"
                  onClick={handleDownload}
                >
                  <Icon
                    icon={
                      imageFeedback === "downloaded"
                        ? ICONS.copied
                        : ICONS.download
                    }
                  />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-full corner-squircle"
                  onClick={handleShareImage}
                >
                  <Icon icon={ICONS.share} />
                  Share
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
