import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// aui.ma's mail server silently drops mail from this domain (no bounce, no spam folder, nothing
// — confirmed while setting this up) since it's a brand-new sender with no reputation there yet.
// Gmail actually delivers it (to spam initially, until marked "not spam" once). Switch back to a
// malik.lahlou@aui.ma once AUI's IT allowlists auimap.ma
const ADMIN_EMAIL = "lahloumalik66@gmail.com"
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
