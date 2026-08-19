import { createHash, timingSafeEqual } from "node:crypto"

const SECRET_CODE = (() => {
  const value = process.env.ADMIN_SECRET_CODE
  if (!value) {
    throw new Error("ADMIN_SECRET_CODE must be set — refusing to run with a blank, guessable auth secret.")
  }
  return value
})()

export const AUTH_COOKIE_NAME = "aui_map_admin_auth"

const hashCode = (code: string) => createHash("sha256").update(code).digest()

export function getExpectedAuthCookieValue(): string {
  return hashCode(SECRET_CODE).toString("hex")
}

export function isCodeCorrect(code: string): boolean {
  const expected = hashCode(SECRET_CODE)
  const actual = hashCode(code)
  return timingSafeEqual(expected, actual)
}

export function isAuthCookieValid(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false
  const expected = Buffer.from(getExpectedAuthCookieValue(), "hex")
  const actual = Buffer.from(cookieValue, "hex")
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
