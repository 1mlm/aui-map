export function extractErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}
