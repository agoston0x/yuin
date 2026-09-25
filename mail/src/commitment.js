/**
 * `keccak(code ‖ email ‖ nonce)`.
 *
 * The nonce is per attempt, so a commitment published for one sign-up cannot be replayed
 * against another, and an old commitment cannot be ground down to recover the code it
 * stood for once the attempt is over. Addresses are lowercased first, because a person who
 * types their address with a capital letter is the same person.
 */
import { keccak256, encodePacked, toHex } from 'viem'
import { randomInt, webcrypto } from 'node:crypto'

export function commit({ code, email, nonce }) {
  return keccak256(encodePacked(['string', 'string', 'bytes32'], [code, email.toLowerCase(), nonce]))
}

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function newNonce() {
  return toHex(webcrypto.getRandomValues(new Uint8Array(32)))
}
