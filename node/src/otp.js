/**
 * One half of an email code.
 *
 * A node mails a code and publishes only `keccak(code ‖ email ‖ nonce)`. The other half
 * comes from a sender this node does not control — the app's own mail service, or another
 * node — so neither party can sign someone in alone, and compromising one mailbox gets an
 * attacker exactly half of what they need.
 *
 * The codes are held in memory with a short life. A node that restarts forgets them,
 * which is the correct behaviour: the user asks again and gets new ones.
 */
import { keccak256, encodePacked, toHex } from 'viem'
import { randomInt } from 'node:crypto'

const TTL_MS = 10 * 60 * 1000
const issued = new Map() // `${email}:${nonce}` => { commitment, expiresAt }

export function commitment({ code, email, nonce }) {
  return keccak256(encodePacked(['string', 'string', 'bytes32'], [code, email.toLowerCase(), nonce]))
}

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function newNonce() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** Returns the commitment to publish and the code to mail. The caller mails it. */
export function issue({ email, nonce }) {
  const code = newCode()
  const value = commitment({ code, email, nonce })
  issued.set(key(email, nonce), { commitment: value, expiresAt: Date.now() + TTL_MS })
  return { code, commitment: value }
}

export function check({ email, nonce, code }) {
  const record = issued.get(key(email, nonce))
  if (!record) return false
  if (Date.now() > record.expiresAt) {
    issued.delete(key(email, nonce))
    return false
  }
  // Consumed either way: a code is worth exactly one attempt.
  issued.delete(key(email, nonce))
  return record.commitment === commitment({ code, email, nonce })
}

function key(email, nonce) {
  return `${email.toLowerCase()}:${nonce}`
}
