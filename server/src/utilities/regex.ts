export function escapeRegex(string: string): string {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
}
