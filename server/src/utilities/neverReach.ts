import { NeverReachError } from "@/errors"

export function neverReach(message = "never reach."): never {
  throw new NeverReachError(message)
}
