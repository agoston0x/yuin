/**
 * `H(code‖email‖nonce)`. The nonce is per attempt, so a commitment cannot be replayed
 * against a second sign-up and a code cannot be brute-forced out of an old one.
 */

export function commit({ code, email, nonce }) {
  throw new Error('not implemented')
}
