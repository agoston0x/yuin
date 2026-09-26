// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INodeRegistry} from "./interfaces/INodeRegistry.sol";
import {IOwners} from "./interfaces/IOwners.sol";
import {Sig} from "./lib/Sig.sol";

/**
 * LEGACY — superseded by EmailIdentityRegistry and SenderRegistry.
 *
 * This is the staked-quorum path: a majority of registered nodes verifying a provider's
 * token and signing an attestation. It is sound and it is tested, and it is not what gets
 * deployed, because it needs five operators alive before anyone can sign in at all.
 *
 * Kept because the argument for it survives the pivot — the objection was operational,
 * never cryptographic — and because the shape here is where this goes again once there
 * are enough operators to justify it. See docs/PIVOT.md.
 */

/**
 * The mapping nobody owns.
 *
 * A credential is `keccak(iss ‖ sub ‖ salt)` — a Google subject, a World nullifier, an
 * email address. What it hashes never appears here, so this contract knows that some
 * credential controls some identity and nothing else. The thing a centralized provider
 * holds is precisely the thing this contract cannot.
 *
 * Two ways in. A credential for a brand-new identity is written by the node quorum, which
 * is the only party that has seen the provider's token. A credential added to an identity
 * that already exists is written on an owner's signature instead — adding a recovery
 * method is an act of ownership, not of consensus, and the quorum has no business doing
 * it alone.
 *
 * Write-once per credential, and no admin: there is no function here that can point an
 * existing credential somewhere new, which is what makes the mapping worth trusting.
 */
contract IdentityRegistry {
    INodeRegistry public immutable nodes;

    /// credentialHash => identity
    mapping(bytes32 => address) public identityOf;

    /// Consumed once per owner-signed link, so a signature cannot be replayed.
    mapping(address => uint256) public nonceOf;

    event CredentialLinked(bytes32 indexed credentialHash, address indexed identity);

    error AlreadyLinked();
    error ZeroIdentity();
    error NotEnoughSigners();
    error SignersOutOfOrder();
    error NotANode(address signer);
    error NotAnOwner(address signer);

    constructor(INodeRegistry nodeRegistry) {
        nodes = nodeRegistry;
    }

    /**
     * The first credential for an identity that does not exist yet.
     *
     * Every signature covers the same digest, and the digest names this contract and this
     * chain — an attestation gathered for one deployment is meaningless at another.
     * Signers must arrive in ascending order, which is how duplicates are excluded without
     * a second pass over the array.
     */
    function link(bytes32 credentialHash, address identity, bytes[] calldata signatures) external {
        if (identity == address(0)) revert ZeroIdentity();
        if (identityOf[credentialHash] != address(0)) revert AlreadyLinked();

        bytes32 digest = linkDigest(credentialHash, identity);

        uint256 threshold = nodes.threshold();
        if (signatures.length < threshold) revert NotEnoughSigners();

        address previous = address(0);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = Sig.recover(digest, signatures[i]);
            if (signer <= previous) revert SignersOutOfOrder();
            if (!nodes.isActive(signer)) revert NotANode(signer);
            previous = signer;
        }

        identityOf[credentialHash] = identity;
        emit CredentialLinked(credentialHash, identity);
    }

    /**
     * Another credential for an identity that already exists — a second provider, a
     * passkey, a recovery method. One owner signature is enough, because an owner can
     * already do anything this credential would later allow.
     */
    function linkWithOwner(bytes32 credentialHash, address identity, bytes calldata ownerSignature) external {
        if (identity == address(0)) revert ZeroIdentity();
        if (identityOf[credentialHash] != address(0)) revert AlreadyLinked();

        uint256 nonce = nonceOf[identity];
        address signer = Sig.recover(ownerLinkDigest(credentialHash, identity, nonce), ownerSignature);
        if (!IOwners(identity).isOwner(signer)) revert NotAnOwner(signer);

        nonceOf[identity] = nonce + 1;
        identityOf[credentialHash] = identity;
        emit CredentialLinked(credentialHash, identity);
    }

    function linkDigest(bytes32 credentialHash, address identity) public view returns (bytes32) {
        return keccak256(abi.encode("manju/link", block.chainid, address(this), credentialHash, identity));
    }

    function ownerLinkDigest(bytes32 credentialHash, address identity, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return
            keccak256(abi.encode("manju/link-owner", block.chainid, address(this), credentialHash, identity, nonce));
    }
}
