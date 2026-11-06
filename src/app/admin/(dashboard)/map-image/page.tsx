import { redirect } from "next/navigation"

// everything about the campus drawing lives in one page now
export default function Page() {
  redirect("/admin/drawing?view=image")
}
