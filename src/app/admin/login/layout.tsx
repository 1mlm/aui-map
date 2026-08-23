import type { Metadata } from "next"
import type { PropsWithChildren } from "react"

export const metadata: Metadata = { title: "Log in" }

export default function AdminLoginLayout({ children }: PropsWithChildren) {
  return children
}
