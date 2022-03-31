export function neverReach(message = "never reach."): never {
  throw new Error(message)
}
