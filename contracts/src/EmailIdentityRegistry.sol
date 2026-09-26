// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISenderRegistry} from "./interfaces/ISenderRegistry.sol";
import {IAccountFactory} from "./interfaces/IAccountFactory.sol";
import {Sig} from "./lib/Sig.sol";

/**
 * An account from an email address and a password, with nobody in a position to take it.
 *
 * The identity is `keccak(email ‖ argon2(password))`, computed in the browser. Neither
 * half reaches this contract: what arrives is one hash, and a hash of a stretched
 * password is not a thing anyone is going to walk backwards.
 *
 * Creating an account takes two signatures from two senders who mailed two codes. That is
 * not because two mailboxes are more secure than one — they are both the same mailbox —
 * but because it takes two independent operators to agree, and the password neither of
 * them has is what actually holds the identity together. Collude without it and you
 * create an empty account at an address nobody will ever fund.
 *
 * What this replaces: a staked node network reaching threshold consensus over a gossip
 * channel. That was a better story and a worse product — five moving parts that had to
 * all be alive for anyone to sign in. This is two HTTP services and a write-once mapping.
 * The old path is still in the tree, marked legacy, because the argument for it is sound
 * and the argument against it was only ever operational.
 */
contract EmailIdentityRegistry {
    ISenderRegistry public immutable senders;
    IAccountFactory public immutable factory;

    /// How many senders must sign. Two, and there is no configuration to weaken it.
    uint256 public constant REQUIRED_SIGNATURES = 2;

    /// identityHash => account
    mapping(bytes32 => address) public accountOf;

    /// Each signed approval is good exactly once.
    mapping(bytes32 => bool) public usedDigest;

    event AccountCreated(bytes32 indexed identityHash, address indexed account, address firstOwner);

    error AlreadyExists();
    error ZeroIdentity();
    error ZeroOwner();
    error Expired();
    error Replayed();
    error WrongSignatureCount();
    error SignersOutOfOrder();
    error NotASender(address signer);

    constructor(ISenderRegistry senders_, IAccountFactory factory_) {
        senders = senders_;
        factory = factory_;
    }

    /**
     * Where the account will be, before it is anywhere.
     *
     * The address is derived rather than assigned, so someone can be told where their
     * money is going before they have finished signing up — and so a second attempt after
     * a dropped connection lands in the same place rather than creating a stranger.
     */
    function addressFor(bytes32 identityHash, address firstOwner) external view returns (address) {
        return factory.personalAddress(identityHash, firstOwner);
    }

    /**
     * Create the account.
     *
     * Both signatures cover the same digest, and the digest names this chain and this
     * contract — an approval gathered for one deployment is worthless at another. Signers
     * must arrive in ascending address order, which is how one sender signing twice is
     * excluded without a second pass over the array.
     */
    function createAccount(
        bytes32 identityHash,
        address firstOwner,
        uint256 nonce,
        uint64 expiry,
        bytes[] calldata signatures
    ) external returns (address account) {
        if (identityHash == bytes32(0)) revert ZeroIdentity();
        if (firstOwner == address(0)) revert ZeroOwner();
        if (accountOf[identityHash] != address(0)) revert AlreadyExists();
        if (block.timestamp > expiry) revert Expired();
        if (signatures.length != REQUIRED_SIGNATURES) revert WrongSignatureCount();

        bytes32 digest = createDigest(identityHash, firstOwner, nonce, expiry);
        if (usedDigest[digest]) revert Replayed();
        usedDigest[digest] = true;

        address previous = address(0);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = Sig.recover(digest, signatures[i]);
            if (signer <= previous) revert SignersOutOfOrder();
            if (!senders.isSender(signer)) revert NotASender(signer);
            previous = signer;
        }

        account = factory.deployPersonal(identityHash, firstOwner);
        accountOf[identityHash] = account;

        emit AccountCreated(identityHash, account, firstOwner);
    }

    function createDigest(bytes32 identityHash, address firstOwner, uint256 nonce, uint64 expiry)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode("yuin/create-account", block.chainid, address(this), identityHash, firstOwner, nonce, expiry)
        );
    }
}
