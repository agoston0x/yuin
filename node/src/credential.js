/**
 * What a credential hash is.
 *
 * `keccak(iss ‖ sub ‖ salt)`, and the three parts matter in that order. The issuer keeps
 * Google's subject 12345 from colliding with World's nullifier 12345. The subject is the
 * only part that identifies a person. The salt is protocol-wide and public — it is not a
 * secret and is not pretended to be one. It raises the cost of sweeping a leaked list of
 * subjects against the registry; it does not stop someone who already knows exactly whose
 * account they are looking for.
 *
 * The honest version of the privacy claim: the chain holds no email address, and nobody
 * operating this can produce one. A targeted attacker who already has the subject can
 * confirm a guess. That is a meaningfully weaker statement than "anonymous", and it is
 * the one that is true.
 */
import { keccak256, encodePacked } from 'viem'

export const ISSUERS = {
  google: 'https://accounts.google.com',
  world: 'world.id',
  email: 'manju.email',
  passkey: 'manju.passkey',
}

export function credentialHash({ iss, sub, salt }) {
  return keccak256(encodePacked(['string', 'string', 'bytes32'], [iss, sub, salt]))
}
