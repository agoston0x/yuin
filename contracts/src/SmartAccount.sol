// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOwners} from "./interfaces/IOwners.sol";
import {WebAuthn} from "./lib/WebAuthn.sol";
import {IAccount4337, PackedUserOperation} from "./interfaces/IEntryPoint.sol";
import {Sig} from "./lib/Sig.sol";

/**
 * An ERC-4337 account with a list of owners rather than one, and session keys that are
 * neither permanent nor unlimited.
 *
 * The browser holds a session key. It expires, it has a spend cap, and the cap is
 * enforced here rather than by whatever code asked for the signature — so the worst a
 * stolen tab can do is bounded, and it stops being possible at a known time.
 *
 * Ownership is the serious thing, and there are two ways to get it. An existing owner can
 * add another immediately: they could already move everything, so nothing new is being
 * granted. The node quorum can propose one, for someone who lost every device they had —
 * and that proposal waits out a timelock in the open, where any current owner can veto it.
 * A recovery that nobody objects to is a recovery; one the real owner is awake for is an
 * attempted theft, and the delay is what gives them the chance to say so.
 *
 * Adding an ordinary EOA as an owner is the exit. From then on the account answers to
 * MetaMask and none of this is in the way.
 */
contract SmartAccount is IOwners, IAccount4337 {
    uint256 internal constant VALID = 0;
    uint256 internal constant INVALID = 1;

    /// Leading byte marking a passkey signature rather than a plain ECDSA one.
    bytes1 internal constant PASSKEY_SIGNATURE = 0x01;

    /// Long enough that a person notices an email about it before it lands.
    uint256 public constant RECOVERY_DELAY = 2 days;

    struct Session {
        uint64 expiry;
        uint256 spendCap;
        uint256 spent;
    }

    struct PendingOwner {
        uint64 executeAfter;
        bool exists;
    }

    /**
     * A passkey, as an owner.
     *
     * The device holds the private half and will not surrender it, which makes this the
     * one credential here that survives the browser being cleared, the laptop being lost,
     * or the user never having heard of a seed phrase. Stored as the raw P-256 point
     * because that is what a verifier wants.
     */
    struct Passkey {
        uint256 x;
        uint256 y;
        bool exists;
    }

    address public immutable entryPoint;
    address public immutable quorum; // the identity registry's node quorum, via the factory

    mapping(address => bool) public isOwner;
    uint256 public ownerCount;

    /// credentialId => the key behind it.
    mapping(bytes32 => Passkey) public passkeys;
    bytes32[] public passkeyIds;

    /**
     * Where P-256 signatures get checked. RIP-7212's precompile where a chain has it, a
     * Solidity implementation where it does not — configuration rather than a constant,
     * because getting it wrong means passkeys silently stop working.
     */
    address public p256Verifier;
    mapping(address => Session) public sessions;
    mapping(address => PendingOwner) public pending;

    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RecoveryProposed(address indexed owner, uint64 executeAfter);
    event RecoveryVetoed(address indexed owner);
    event RecoveryCompleted(address indexed owner);
    event SessionRegistered(address indexed key, uint64 expiry, uint256 spendCap);
    event SessionRevoked(address indexed key);
    event PasskeyAdded(bytes32 indexed credentialId);
    event PasskeyRemoved(bytes32 indexed credentialId);
    event VerifierChanged(address indexed verifier);

    error NotAuthorized();
    error NotEntryPoint();
    error AlreadyOwner();
    error NotPending();
    error TooEarly();
    error LastOwner();
    error CallFailed();
    error PasskeyExists();
    error NoSuchPasskey();
    error NoVerifier();

    constructor(address entryPoint_, address quorum_, address firstOwner) {
        entryPoint = entryPoint_;
        quorum = quorum_;
        isOwner[firstOwner] = true;
        ownerCount = 1;
        emit OwnerAdded(firstOwner);
    }

    // ---- passkeys ----

    /**
     * Add a passkey as an owner.
     *
     * Only an existing owner can, because a passkey can do everything an owner can and
     * granting that is an act of ownership. This is the step that turns "no seed phrase"
     * from a slogan into something true: after it, losing this browser costs nothing.
     */
    function addPasskey(bytes32 credentialId, uint256 x, uint256 y) external onlySelfOrOwner {
        if (passkeys[credentialId].exists) revert PasskeyExists();
        passkeys[credentialId] = Passkey({x: x, y: y, exists: true});
        passkeyIds.push(credentialId);
        emit PasskeyAdded(credentialId);
    }

    function removePasskey(bytes32 credentialId) external onlySelfOrOwner {
        if (!passkeys[credentialId].exists) revert NoSuchPasskey();
        delete passkeys[credentialId];

        for (uint256 i = 0; i < passkeyIds.length; i++) {
            if (passkeyIds[i] == credentialId) {
                passkeyIds[i] = passkeyIds[passkeyIds.length - 1];
                passkeyIds.pop();
                break;
            }
        }
        emit PasskeyRemoved(credentialId);
    }

    function setP256Verifier(address verifier) external onlySelfOrOwner {
        p256Verifier = verifier;
        emit VerifierChanged(verifier);
    }

    function passkeyCount() external view returns (uint256) {
        return passkeyIds.length;
    }

    /**
     * Does this passkey signature authorise this operation?
     *
     * Public so a caller can ask before spending gas on a user operation, and so the
     * check is testable on its own rather than only through the entry point.
     */
    function isValidPasskeySignature(bytes32 credentialId, bytes32 challenge, WebAuthn.Signature memory signature)
        public
        view
        returns (bool)
    {
        Passkey memory key = passkeys[credentialId];
        if (!key.exists) return false;
        if (p256Verifier == address(0)) return false;
        return WebAuthn.verify(signature, challenge, key.x, key.y, p256Verifier);
    }

    receive() external payable {}

    modifier onlySelfOrOwner() {
        if (msg.sender != address(this) && !isOwner[msg.sender]) revert NotAuthorized();
        _;
    }

    // ---- owners ----

    function addOwner(address owner) external onlySelfOrOwner {
        if (isOwner[owner]) revert AlreadyOwner();
        isOwner[owner] = true;
        ownerCount++;
        emit OwnerAdded(owner);
    }

    function removeOwner(address owner) external onlySelfOrOwner {
        if (!isOwner[owner]) revert NotAuthorized();
        if (ownerCount == 1) revert LastOwner();
        isOwner[owner] = false;
        ownerCount--;
        emit OwnerRemoved(owner);
    }

    // ---- recovery ----

    /**
     * Someone has convinced the quorum they are the person behind this identity. They are
     * probably right. The delay exists for when they are not.
     */
    function proposeOwner(address owner) external {
        if (msg.sender != quorum) revert NotAuthorized();
        if (isOwner[owner]) revert AlreadyOwner();
        pending[owner] = PendingOwner({executeAfter: uint64(block.timestamp + RECOVERY_DELAY), exists: true});
        emit RecoveryProposed(owner, uint64(block.timestamp + RECOVERY_DELAY));
    }

    /// Anyone who already holds this account can stop a recovery, no reason required.
    function vetoRecovery(address owner) external onlySelfOrOwner {
        if (!pending[owner].exists) revert NotPending();
        delete pending[owner];
        emit RecoveryVetoed(owner);
    }

    /// Permissionless once the delay has run: the waiting was the protection, not the caller.
    function completeRecovery(address owner) external {
        PendingOwner memory p = pending[owner];
        if (!p.exists) revert NotPending();
        if (block.timestamp < p.executeAfter) revert TooEarly();

        delete pending[owner];
        isOwner[owner] = true;
        ownerCount++;
        emit OwnerAdded(owner);
        emit RecoveryCompleted(owner);
    }

    // ---- sessions ----

    function registerSession(address key, uint64 expiry, uint256 spendCap) external onlySelfOrOwner {
        sessions[key] = Session({expiry: expiry, spendCap: spendCap, spent: 0});
        emit SessionRegistered(key, expiry, spendCap);
    }

    function revokeSession(address key) external onlySelfOrOwner {
        delete sessions[key];
        emit SessionRevoked(key);
    }

    // ---- 4337 ----

    /**
     * An owner's signature is good for anything. A session key's is good until it expires,
     * and only while what it has spent stays under its cap.
     *
     * The expiry is returned to the entry point rather than checked here, so a user
     * operation submitted a second too late is rejected by the protocol itself.
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (msg.sender != entryPoint) revert NotEntryPoint();

        // A passkey signature is longer and structured; an ECDSA one is 65 bytes flat.
        // The first byte says which, so neither has to be guessed at by length.
        if (userOp.signature.length > 0 && userOp.signature[0] == PASSKEY_SIGNATURE) {
            if (!_validPasskey(userOp.signature, userOpHash)) return INVALID;
            _payEntryPoint(missingAccountFunds);
            return VALID;
        }

        address signer;
        // A signature over the raw hash; wallets that prefix should sign the same bytes.
        try this.recoverFor(userOpHash, userOp.signature) returns (address recovered) {
            signer = recovered;
        } catch {
            return INVALID;
        }

        if (isOwner[signer]) {
            validationData = VALID;
        } else {
            Session storage session = sessions[signer];
            if (session.expiry == 0) return INVALID;

            uint256 value = _valueOf(userOp.callData);
            if (session.spent + value > session.spendCap) return INVALID;
            session.spent += value;

            // validAfter 0, validUntil = expiry, packed as the entry point expects.
            validationData = uint256(session.expiry) << 160;
        }

        _payEntryPoint(missingAccountFunds);
    }

    function _payEntryPoint(uint256 missingAccountFunds) internal {
        if (missingAccountFunds > 0) {
            (bool ok,) = msg.sender.call{value: missingAccountFunds}("");
            ok; // the entry point is the judge of whether it got paid
        }
    }

    /**
     * A passkey signature carries its own envelope: which credential, the authenticator's
     * own bytes, the JSON the browser built, and the curve values. All of it is needed,
     * because the challenge lives inside the JSON rather than being signed directly.
     */
    function _validPasskey(bytes calldata signature, bytes32 userOpHash) internal view returns (bool) {
        (bytes32 credentialId, bytes memory authenticatorData, string memory clientDataJSON, uint256 r, uint256 s) =
            abi.decode(signature[1:], (bytes32, bytes, string, uint256, uint256));

        return isValidPasskeySignature(
            credentialId,
            userOpHash,
            WebAuthn.Signature({
                authenticatorData: authenticatorData,
                clientDataJSON: clientDataJSON,
                r: r,
                s: s
            })
        );
    }

    /// External so the try/catch above can swallow a malformed signature.
    function recoverFor(bytes32 digest, bytes calldata signature) external pure returns (address) {
        return Sig.recover(digest, signature);
    }

    // ---- execution ----

    function execute(address to, uint256 value, bytes calldata data) external {
        if (msg.sender != entryPoint && !isOwner[msg.sender]) revert NotAuthorized();
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) _bubble(ret);
    }

    function executeBatch(address[] calldata to, uint256[] calldata value, bytes[] calldata data) external {
        if (msg.sender != entryPoint && !isOwner[msg.sender]) revert NotAuthorized();
        for (uint256 i = 0; i < to.length; i++) {
            (bool ok, bytes memory ret) = to[i].call{value: value[i]}(data[i]);
            if (!ok) _bubble(ret);
        }
    }

    /**
     * How much native value a user operation moves, read out of its calldata.
     *
     * Only the two shapes this account can actually be asked to perform are understood;
     * anything else is treated as spending the whole cap, because a session key should
     * never be able to do something the cap cannot be reasoned about.
     */
    function _valueOf(bytes calldata callData) internal pure returns (uint256 total) {
        if (callData.length < 4) return type(uint256).max;
        bytes4 selector = bytes4(callData[:4]);

        if (selector == SmartAccount.execute.selector) {
            (, uint256 value,) = abi.decode(callData[4:], (address, uint256, bytes));
            return value;
        }
        if (selector == SmartAccount.executeBatch.selector) {
            (, uint256[] memory values,) = abi.decode(callData[4:], (address[], uint256[], bytes[]));
            for (uint256 i = 0; i < values.length; i++) {
                total += values[i];
            }
            return total;
        }
        return type(uint256).max;
    }

    function _bubble(bytes memory ret) internal pure {
        if (ret.length == 0) revert CallFailed();
        assembly {
            revert(add(ret, 0x20), mload(ret))
        }
    }
}
