/**
 * Is this login real?
 *
 * Three questions, none of which require trusting whoever sent the request. Did the
 * provider sign this token; is it for an app that registered with us; and is it bound to
 * the key the browser wants authorized.
 *
 * The last one is load-bearing. The page put `H(sessionPK)` in the OAuth nonce before it
 * ever contacted Google, and Google signed the nonce along with everything else — so a
 * token naming one session key cannot be replayed to authorize a different one. Without
 * that check, a node that intercepted a token could mint itself an account belonging to
 * someone else, and the whole structure would rest on the nodes being honest.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { keccak256 } from 'viem'
import { ISSUERS } from './credential.js'

const JWKS_URLS = {
  [ISSUERS.google]: 'https://www.googleapis.com/oauth2/v3/certs',
}

const cache = new Map()

/** One remote key set per issuer, cached — jose handles rotation and its own TTL. */
export function jwks(issuer) {
  const url = JWKS_URLS[issuer]
  if (!url) throw new Error(`no key set known for issuer ${issuer}`)
  if (!cache.has(issuer)) cache.set(issuer, createRemoteJWKSet(new URL(url)))
  return cache.get(issuer)
}

export function nonceFor(sessionPublicKey) {
  return keccak256(sessionPublicKey)
}

/**
 * Returns the claims we are prepared to act on, or throws. Nothing partial: a caller
 * should not be able to proceed with a token that failed one of three checks.
 */
export async function verifyIdToken({ token, audience, sessionPublicKey, issuer = ISSUERS.google }) {
  const { payload } = await jwtVerify(token, jwks(issuer), {
    issuer: [issuer, issuer.replace('https://', '')],
    audience,
  })

  const expected = nonceFor(sessionPublicKey)
  if (!payload.nonce) throw new Error('token carries no nonce, so it is bound to nothing')
  if (payload.nonce.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('token is bound to a different session key')
  }

  return { iss: issuer, sub: payload.sub, aud: payload.aud, exp: payload.exp }
}
