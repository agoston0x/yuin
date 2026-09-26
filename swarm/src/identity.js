/**
 * Turning an email address and a password into an identity, in the browser.
 *
 * `keccak(email ‖ argon2id(password))`. Neither half ever leaves this machine: the
 * senders see an email address they already mailed, and the chain sees one hash. A
 * stretched password is not something anyone walks backwards — that is the entire
 * security of this, and it is why the parameters below are not negotiable downward.
 *
 * The salt is the email address rather than something random, because the derivation has
 * to be reproducible from nothing but what the user remembers. That weakens it against a
 * precomputed attack on one specific address, which is what the Argon2 cost is for.
 */
import { argon2id } from 'hash-wasm'
import { encodePacked, keccak256 } from 'viem'

/**
 * Deliberately slow. A second or two on a phone is an annoyance; it is also the
 * difference between a password being guessable and not.
 */
export const PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MiB
  hashLength: 32,
}

export async function stretch({ email, password }) {
  const hex = await argon2id({
    password,
    salt: new TextEncoder().encode(`yuin/email/${email.trim().toLowerCase()}`),
    ...PARAMS,
    outputType: 'hex',
  })
  return `0x${hex}`
}

export function identityHashFrom({ email, stretched }) {
  return keccak256(encodePacked(['string', 'bytes32'], [email.trim().toLowerCase(), stretched]))
}

/** Everything in one step, because the two halves are never useful apart. */
export async function deriveIdentity({ email, password }) {
  const stretched = await stretch({ email, password })
  return { stretched, identityHash: identityHashFrom({ email, stretched }) }
}
