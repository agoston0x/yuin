/**
 * WebAuthn, as a second owner of the account.
 *
 * A passkey is a P-256 keypair the device holds and will not give up. Registering it on
 * the account is what makes "no seed phrase, and you can always get back in" true rather
 * than aspirational: after this, losing the browser costs nothing.
 *
 * The public key arrives from the authenticator as COSE-encoded CBOR, and what the
 * contract needs is the two coordinates. Rather than pull in a CBOR parser for one shape
 * of one structure, the two 32-byte values are located by their labels — which is exactly
 * as fragile as it sounds, so it is checked rather than assumed.
 */
import { keccak256, toHex } from 'viem'

const STORE = 'yuin.passkey'

export function supported() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

function challenge() {
  return crypto.getRandomValues(new Uint8Array(32))
}

/**
 * Pull x and y out of what the authenticator returned.
 *
 * `getPublicKey()` hands back SPKI DER, not COSE — an algorithm identifier followed by a
 * bit string, and for P-256 that bit string ends with the uncompressed point: 0x04, then
 * the two 32-byte coordinates. So the last 65 bytes are the part that matters, and the
 * 0x04 is checked rather than assumed, because a key that is not an uncompressed P-256
 * point would otherwise be silently misread as one.
 */
export function coordinatesFrom(publicKey) {
  const bytes = new Uint8Array(publicKey)
  if (bytes.length < 65) throw new Error('that key is too short to be a P-256 point')

  const point = bytes.slice(bytes.length - 65)
  if (point[0] !== 0x04) {
    throw new Error('this authenticator did not return an uncompressed P-256 point')
  }

  return { x: toHex(point.slice(1, 33)), y: toHex(point.slice(33, 65)) }
}

/** The credential id, hashed, because the account keys passkeys by a bytes32. */
export function credentialIdFor(rawId) {
  return keccak256(new Uint8Array(rawId))
}

export async function create({ account, label }) {
  if (!supported()) throw new Error('this browser has no passkey support')

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'Yuin', id: location.hostname },
      user: {
        id: new TextEncoder().encode(account),
        name: label ?? account,
        displayName: label ?? account,
      },
      // P-256 only: it is what the on-chain verifier can check.
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60_000,
      attestation: 'none',
    },
  })

  const { x, y } = coordinatesFrom(credential.response.getPublicKey())
  const record = {
    id: credential.id,
    credentialId: credentialIdFor(credential.rawId),
    account,
    x,
    y,
    registeredOnChain: false,
  }

  localStorage.setItem(STORE, JSON.stringify(record))
  return record
}

export async function assert({ challenge: expected }) {
  if (!supported()) throw new Error('this browser has no passkey support')
  const stored = current()

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: expected ?? challenge(),
      rpId: location.hostname,
      allowCredentials: stored ? [{ type: 'public-key', id: fromBase64Url(stored.id) }] : [],
      userVerification: 'preferred',
      timeout: 60_000,
    },
  })

  return {
    credentialId: credentialIdFor(assertion.rawId),
    authenticatorData: new Uint8Array(assertion.response.authenticatorData),
    clientDataJSON: new TextDecoder().decode(assertion.response.clientDataJSON),
    signature: new Uint8Array(assertion.response.signature),
  }
}

export function current() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE) : null
  return raw ? JSON.parse(raw) : null
}

export function markRegistered() {
  const record = current()
  if (!record) return
  localStorage.setItem(STORE, JSON.stringify({ ...record, registeredOnChain: true }))
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
