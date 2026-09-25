/**
 * Session keys, bounded by an expiry and a spend cap the account itself enforces — not
 * this library. Losing the browser loses a key that could not have drained anything.
 */
import type { Session } from './types.js'

export function current(): Session | null {
  throw new Error('not implemented')
}

export async function renew(): Promise<Session> {
  throw new Error('not implemented')
}

export async function signUserOp(userOp: unknown): Promise<string> {
  throw new Error('not implemented')
}
