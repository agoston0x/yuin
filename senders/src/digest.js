/**
 * The bytes this sender puts its name to.
 *
 * Exactly what EmailIdentityRegistry.createDigest reconstructs before it counts
 * signatures — the chain id and the registry address are inside it, so an approval
 * gathered for one deployment cannot be spent at another, and one gathered for one owner
 * cannot create an account for someone else.
 */
import { encodeAbiParameters, keccak256 } from 'viem'
import { sign, signatureToHex } from 'viem/accounts'

export function createDigest({ chainId, registry, identityHash, firstOwner, nonce, expiry }) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint64' },
      ],
      ['yuin/create-account', BigInt(chainId), registry, identityHash, firstOwner, BigInt(nonce), BigInt(expiry)],
    ),
  )
}

/** Over the raw digest, with no message prefix — the contract uses ecrecover directly. */
export async function signDigest({ digest, privateKey }) {
  return signatureToHex(await sign({ hash: digest, privateKey }))
}
