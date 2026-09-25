/**
 * The session key.
 *
 * Generated here, in the browser, before any provider is contacted — and never sent
 * anywhere. Its hash goes into the OAuth nonce, so the token that comes back names this
 * key and authorizes nothing else. A node that intercepted the token could not use it to
 * put its own key on someone's account.
 *
 * It lives in session storage rather than local storage: closing the tab ends it, which
 * is the behaviour someone signing in on a borrowed laptop would expect.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { keccak256, toHex } from 'viem'
import { secp256k1 } from '@noble/curves/secp256k1'

const KEY = 'manju.session'

export function create() {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const publicKey = toHex(secp256k1.getPublicKey(privateKey.slice(2), true))
  const session = { privateKey, address: account.address, publicKey }
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

/** What goes in the OAuth nonce. The node recomputes it and compares. */
export function nonceFor(publicKey) {
  return keccak256(publicKey)
}
