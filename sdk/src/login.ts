/**
 * Sending someone to sign in, and picking them back up afterwards.
 *
 * The app never handles a token, an email address or a provider. It sends a public key and
 * receives an account address — which is all it needed, and all it should ever have had.
 */
import { keccak256, toHex } from 'viem'
import * as session from './session.js'

export interface LoginOptions {
  signinUrl: string
  app: string
  returnTo?: string
}

export function appIdFor(label: string): `0x${string}` {
  return keccak256(toHex(label))
}

/** Leaves the page. Anything after this call does not run. */
export function start({ signinUrl, app, returnTo }: LoginOptions): never {
  const current = session.load() ?? session.create()
  const url = new URL(signinUrl)
  url.searchParams.set('app', app)
  url.searchParams.set('session_pk', current.publicKey)
  url.searchParams.set('return_to', returnTo ?? location.href)
  location.href = url.toString()
  throw new Error('redirecting')
}

/**
 * Read the result out of the fragment, where it does not reach a server, and clear it so a
 * reload does not look like a fresh sign-in.
 */
export function finish(): { account: `0x${string}` } | null {
  if (typeof location === 'undefined' || !location.hash) return null
  const params = new URLSearchParams(location.hash.slice(1))
  const identity = params.get('identity') as `0x${string}` | null
  if (!identity) return null

  const current = session.load()
  if (!current) return null
  session.save({ ...current, account: identity })

  history.replaceState(null, '', location.pathname + location.search)
  return { account: identity }
}
