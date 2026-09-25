/**
 * What this node puts its name to.
 *
 * The digest commits to the JWT's hash, not merely its contents, so a node that signs for
 * a login it cannot later produce the token for has signed its own slashing evidence.
 */

export function attestationDigest({ jwtHash, sessionPK, intent, appId, expiry }) {}

export function signShare(digest, nodeKey) {}
