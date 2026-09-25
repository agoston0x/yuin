/**
 * What this node puts its name to.
 *
 * The digest is exactly what IdentityRegistry reconstructs before it counts signatures:
 * the chain id and the registry's own address are in it, so an attestation gathered for
 * one deployment is worthless at another, and a set of signatures collected for one
 * identity cannot be pointed at a different one.
 */
import { encodeAbiParameters, keccak256 } from 'viem'
import { sign, signatureToHex } from 'viem/accounts'

export function linkDigest({ chainId, identityRegistry, credentialHash, identity }) {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'address' }],
      ['manju/link', BigInt(chainId), identityRegistry, credentialHash, identity],
    ),
  )
}

/**
 * Signed over the raw digest, with no message prefix — the registry verifies it with
 * `ecrecover` directly, and a prefix would simply make the signature fail to recover.
 */
export async function signShare({ digest, privateKey }) {
  return signatureToHex(await sign({ hash: digest, privateKey }))
}
