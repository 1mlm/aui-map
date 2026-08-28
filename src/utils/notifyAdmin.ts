import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const ADMIN_EMAIL = "m.lahlou@aui.ma"
// auimap.ma is verified in Resend (SPF/DKIM/MX records added via Vercel DNS), so this can send
// to anyone, not just the Resend account's own email
const FROM_EMAIL = "AUI Map <notify@auimap.ma>"

export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

// fire-and-forget: a failed or unconfigured notification should never block the actual
// suggestion/contribution it's about — this is a heads-up, not the source of truth (that's the DB)
export async function notifyAdmin(subject: string, bodyHtml: string) {
  if (!resend) return
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html: bodyHtml,
    })
  } catch {
    // best-effort
  }
}
