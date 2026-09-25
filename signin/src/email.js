/**
 * Sign-up with no provider at all.
 *
 * Two senders, two codes, and both are required. One comes from a node; the other from a
 * sender the node does not control. Neither can sign anyone in alone, which is the only
 * reason a six-digit number is acceptable as a credential here.
 *
 * The password matters more than either code. The identity key folds in an Argon2 stretch
 * of it, so the two senders colluding — without the password — land on a different,
 * empty identity and learn nothing. That is also why this path may create an identity but
 * may never recover one: a code that arrives in a mailbox is not proof of the person, only
 * of the mailbox.
 */
import { keccak256, toHex, encodePacked } from 'viem'
import { post, gateways } from './nodes.js'

export function newNonce() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** Ask two independent senders. Fewer than two and this path is not available. */
export async function requestCodes({ email }) {
  const urls = await gateways()
  if (urls.length < 2) throw new Error('email sign-up needs two independent senders')

  const nonce = newNonce()
  const commitments = await Promise.all(
    urls.slice(0, 2).map(async (url) => {
      const response = await fetch(new URL('/otp', url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, nonce }),
      })
      if (!response.ok) throw new Error(`sender at ${url} refused`)
      return { url, ...(await response.json()) }
    }),
  )

  return { nonce, senders: commitments.map((c) => c.url) }
}

/**
 * Argon2id through WebCrypto is not available, so the stretch runs in a worker with a
 * WASM build. Until that is wired, PBKDF2 stands in with a high iteration count — weaker,
 * and labelled as such rather than quietly shipped as if it were the same thing.
 */
export async function stretch({ password, email }) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`manju/email/${email.toLowerCase()}`),
      iterations: 600_000,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

export function identityKey({ email, stretched }) {
  return keccak256(encodePacked(['string', 'string', 'bytes32'], ['manju.email', email.toLowerCase(), stretched]))
}

export async function redeem({ email, nonce, codes, password, session }) {
  const stretched = await stretch({ password, email })
  return post('/login/email', {
    email,
    nonce,
    codes,
    credentialKey: identityKey({ email, stretched }),
    sessionPublicKey: session.publicKey,
    sessionAddress: session.address,
  })
}
