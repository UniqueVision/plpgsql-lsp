export function neverReach(message: string): never {
  throw new Error(message)
}
