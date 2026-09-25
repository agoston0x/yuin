/**
 * The session key, made and kept on the app's own origin.
 *
 * It is the only secret in the system, which is why it never crosses an origin: the app
 * generates it, sends the public half to the sign-in page, and the token that comes back
 * is bound to it. The account enforces the expiry and the spend cap, not this file — so a
 * key lifted out of local storage is worth a bounded amount for a bounded time, and
 * nothing after that.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { toHex } from 'viem'
import { secp256k1 } from '@noble/curves/secp256k1'

const KEY = 'manju.session'

export interface StoredSession {
  privateKey: `0x${string}`
  publicKey: `0x${string}`
  address: `0x${string}`
  account?: `0x${string}`
  expiresAt?: number
}

export function create(): StoredSession {
  const privateKey = generatePrivateKey()
  const session: StoredSession = {
    privateKey,
    publicKey: toHex(secp256k1.getPublicKey(privateKey.slice(2), true)),
    address: privateKeyToAccount(privateKey).address,
  }
  save(session)
  return session
}

export function load(): StoredSession | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  const session = JSON.parse(raw) as StoredSession
  if (session.expiresAt && session.expiresAt * 1000 < Date.now()) {
    clear()
    return null
  }
  return session
}

export function save(session: StoredSession) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clear() {
  localStorage.removeItem(KEY)
}

export function signer(session: StoredSession) {
  return privateKeyToAccount(session.privateKey)
}
