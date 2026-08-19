import { redirect } from "next/navigation"

// no separate dashboard landing — pins is the default view
export default function AdminIndexPage() {
  redirect("/admin/pins")
}
