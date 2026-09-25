/**
 * Is this login real? Three questions, none of which require trusting whoever asked.
 *
 * Did the provider sign this token; is it for an app that registered with us; and is it
 * bound to the key the browser wants authorized. The last one is the load-bearing check:
 * the provider put `H(sessionPK)` in the token it signed, so a token naming one key
 * cannot be replayed to authorize another.
 */

export async function jwks(issuer) {}

export async function verifyIdToken({ jwt, expectedAud, sessionPK }) {}
