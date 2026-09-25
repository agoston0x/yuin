// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * The mapping nobody owns.
 *
 * A credential is `keccak(iss ‖ sub ‖ salt)` — a Google subject, a World nullifier, an
 * email. What it hashes never appears here, so this contract knows that some credential
 * controls some identity and nothing more. The thing a centralized provider holds is
 * precisely the thing this contract cannot.
 *
 * Many credentials may point at one identity, so losing a provider is not losing the
 * account. A credential points at one identity forever: write-once, no admin, no upgrade.
 */
contract IdentityRegistry {
    /// credentialHash => identity
    mapping(bytes32 => address) public identityOf;

    event CredentialLinked(bytes32 indexed credentialHash, address indexed identity);

    /// First credential for a new identity. Written by the node quorum, behind a timelock.
    function link(bytes32 credentialHash, address identity, bytes calldata quorumSig) external {}

    /// Another credential for an identity that exists. Adding a recovery method is an act
    /// of ownership, so it takes an owner's signature rather than the quorum's.
    function linkWithOwner(bytes32 credentialHash, address identity, bytes calldata ownerSig) external {}
}
