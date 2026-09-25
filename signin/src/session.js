/**
 * The session key, generated here before any provider is contacted and never sent
 * anywhere. Its hash goes into the OAuth nonce, and that binding is what makes the
 * provider's token authorize this key and no other.
 */

export function generateSessionKey() {}

export function nonceFor(sessionPK) {}
