/**
 * The Google path, and what it costs.
 *
 * A sender verifies an `id_token` against Google's published keys and signs for the
 * account it names. Two senders doing that independently is the same two-of-two as the
 * email path.
 *
 * But it is weaker, and the difference is worth being exact about. In the email flow a
 * password never leaves the browser, so two colluding senders derive a different identity
 * and get an empty account. Here there is no password: an identity is `keccak("google" ‖
 * sub)`, which both senders can compute. Two dishonest senders could therefore create —
 * and own — an account for a Google user who never asked for one.
 *
 * What removes that is verifying the RSA signature on the token on chain, so the token
 * itself authorises the account and no sender is trusted at all. It is expensive and it
 * is not done yet.
 *
 * TODO: on-chain RSA-2048 verification of the Google JWT, replacing this attestation.
 * Until then this path trusts the senders, and says so on the page rather than quietly.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { encodePacked, keccak256 } from 'viem'

const ISSUER = 'https://accounts.google.com'
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

/**
 * The nonce binding is what stops a token being replayed to authorise somebody else's
 * key: the page put the owner address in the OAuth nonce before Google ever saw it.
 */
export async function verifyIdToken({ token, audience, firstOwner }) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: [ISSUER, 'accounts.google.com'],
    audience,
  })

  const expected = keccak256(encodePacked(['address'], [firstOwner]))
  if (!payload.nonce) throw new Error('that token carries no nonce, so it is bound to nothing')
  if (payload.nonce.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('that token is bound to a different key')
  }

  return { sub: payload.sub, aud: payload.aud }
}

/** No password in the mix, which is exactly the weakness described above. */
export function identityFor(sub) {
  return keccak256(encodePacked(['string', 'string'], ['google', sub]))
}
