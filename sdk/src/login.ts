/**
 * Redirect to the sign-in page, come back with an identity.
 *
 * The app never handles a token, a key or an email address. What returns is an account
 * address and a session, which is all it needed.
 */
import type { Session } from './types.js'

export async function login(): Promise<Session> {
  throw new Error('not implemented')
}

export function handleCallback(): Session | null {
  throw new Error('not implemented')
}

export function logout(): void {
  throw new Error('not implemented')
}
