/**
 * The session key.
 *
 * Whoever holds the private key is who the account will answer to, so it is made on the
 * origin that will use it — the app, through the SDK — and this page is handed only the
 * public half. That matters: the sign-in page runs on one fixed domain shared by every
 * app, and a key generated here would either be stranded on that domain or have to travel
 * back across origins in a URL. Neither is acceptable for the one secret in the system.
 *
 * What this page does with the public key is compute the OAuth nonce. Google signs the
 * nonce into the token, and every node checks it — so the token that comes back authorizes
 * the app's key and cannot be replayed to authorize anyone else's.
 *
 * A page opened with no key of its own (the dashboard, signing itself in) makes one and
 * keeps it in session storage, where closing the tab ends it.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { keccak256, toHex } from 'viem'
import { secp256k1 } from '@noble/curves/secp256k1'
import { publicKeyToAddress } from 'viem/utils'

const KEY = 'manju.session'

/** The app made the key; we only ever see its public half. */
export function adopt(publicKey) {
  const session = { publicKey, address: addressFor(publicKey), external: true }
  sessionStorage.setItem(KEY, JSON.stringify(session))
  return session
}

export function create() {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const publicKey = toHex(secp256k1.getPublicKey(privateKey.slice(2), true))
  const session = { privateKey, address: account.address, publicKey, external: false }
  sessionStorage.setItem(KEY, JSON.stringify(session))
  return session
}

export function current() {
  const raw = sessionStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : null
}

export function clear() {
  sessionStorage.removeItem(KEY)
}

/** Compressed or uncompressed both work; the address is of the uncompressed point. */
export function addressFor(publicKey) {
  const point = secp256k1.ProjectivePoint.fromHex(publicKey.slice(2))
  return publicKeyToAddress(toHex(point.toRawBytes(false)))
}

/** What goes in the OAuth nonce. The node recomputes it and compares. */
export function nonceFor(publicKey) {
  return keccak256(publicKey)
}
