// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {WebAuthn} from "../src/lib/WebAuthn.sol";
import {Base64URL} from "../src/lib/Base64URL.sol";
import {PackedUserOperation} from "../src/interfaces/IEntryPoint.sol";

/**
 * A verifier that knows one true answer.
 *
 * P-256 cannot be checked in plain Solidity without vendoring a large library, and what
 * matters here is not whether someone else's curve arithmetic works — it is whether this
 * account builds the same message the authenticator signed. So the mock accepts exactly
 * the tuple a real verifier would accept for the vector below, and rejects everything
 * else. Construct the message wrongly and the test fails, which is the point.
 */
contract ExactVerifier {
    bytes32 public immutable message;
    uint256 public immutable r;
    uint256 public immutable s;
    uint256 public immutable x;
    uint256 public immutable y;

    constructor(bytes32 message_, uint256 r_, uint256 s_, uint256 x_, uint256 y_) {
        message = message_;
        r = r_;
        s = s_;
        x = x_;
        y = y_;
    }

    fallback(bytes calldata data) external returns (bytes memory) {
        (bytes32 h, uint256 r_, uint256 s_, uint256 x_, uint256 y_) =
            abi.decode(data, (bytes32, uint256, uint256, uint256, uint256));
        bool ok = h == message && r_ == r && s_ == s && x_ == x && y_ == y;
        return abi.encode(ok ? uint256(1) : uint256(0));
    }
}

/// Says yes to anything, for testing the checks that happen before the curve.
contract PermissiveVerifier {
    fallback(bytes calldata) external returns (bytes memory) {
        return abi.encode(uint256(1));
    }
}

contract PasskeyTest is Test {
    SmartAccount account;

    address entryPoint = address(0xE417);
    address quorum = address(0x9009);
    uint256 ownerKey = 0xA11CE;
    address owner;

    // Generated with node's P-256 against a real WebAuthn envelope; see the commit that
    // added this file for the script.
    bytes32 constant CHALLENGE = 0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes constant AUTH_DATA = hex"aee5aaf10a8f34e7d46eb65b52abd204185953d762dae280af6a031cc22b56610500000001";
    string constant CLIENT_JSON =
        '{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://yuin.claws.page","crossOrigin":false}';
    bytes32 constant MESSAGE = 0x45bfed3300af51844745a363d184e3f33cc554d62de0a1fb7add95137d40adee;
    uint256 constant X = 0xb415f0afff2998c71b75023c6ca467a5d3ea38eb258f9d2e4234214e9ca1da83;
    uint256 constant Y = 0x59865c7452a99d8945f5e27422d7de652f96f5ec20a0dc29dbaa0546949d4f4b;
    uint256 constant R = 0xe538663e3d3e50d6827574901d042b63200eb5339fa466f2c1d3e1d2ae3a8dd6;
    uint256 constant S = 0x073af9baa2e3c4878305209300a9b10ac59ad9500084d8f5cfb73530abe1d98f;

    bytes32 constant CREDENTIAL = keccak256("credential-one");

    function setUp() public {
        owner = vm.addr(ownerKey);
        account = new SmartAccount(entryPoint, quorum, owner);

        vm.startPrank(owner);
        account.addPasskey(CREDENTIAL, X, Y);
        account.setP256Verifier(address(new ExactVerifier(MESSAGE, R, S, X, Y)));
        vm.stopPrank();
    }

    function signature() internal pure returns (WebAuthn.Signature memory) {
        return WebAuthn.Signature({authenticatorData: AUTH_DATA, clientDataJSON: CLIENT_JSON, r: R, s: S});
    }

    // ---- the message ----

    /// If this drifts, every passkey signature stops verifying. It is the whole contract.
    function test_the_signed_message_is_rebuilt_exactly() public pure {
        assertEq(WebAuthn.signedMessage(AUTH_DATA, CLIENT_JSON), MESSAGE);
    }

    function test_the_challenge_is_encoded_as_the_browser_encodes_it() public pure {
        assertEq(Base64URL.encode(CHALLENGE), "ERERERERERERERERERERERERERERERERERERERERERE");
    }

    // ---- ownership ----

    function test_a_passkey_can_be_added_and_used() public view {
        assertTrue(account.isValidPasskeySignature(CREDENTIAL, CHALLENGE, signature()));
        assertEq(account.passkeyCount(), 1);
    }

    function test_a_stranger_cannot_add_a_passkey() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(SmartAccount.NotAuthorized.selector);
        account.addPasskey(keccak256("theirs"), X, Y);
    }

    function test_a_removed_passkey_stops_working() public {
        vm.prank(owner);
        account.removePasskey(CREDENTIAL);
        assertFalse(account.isValidPasskeySignature(CREDENTIAL, CHALLENGE, signature()));
        assertEq(account.passkeyCount(), 0);
    }

    function test_an_unknown_credential_is_refused() public view {
        assertFalse(account.isValidPasskeySignature(keccak256("someone else"), CHALLENGE, signature()));
    }

    // ---- the checks that matter ----

    /// A signature collected for one operation must not authorise another.
    function test_a_signature_for_another_challenge_is_refused() public {
        address permissive = address(new PermissiveVerifier());
        vm.prank(owner);
        account.setP256Verifier(permissive);

        bytes32 other = keccak256("a different operation");
        assertFalse(
            account.isValidPasskeySignature(CREDENTIAL, other, signature()),
            "the challenge in the JSON must be checked, not assumed"
        );
    }

    /// Nobody touched the device: the flags byte says so.
    function test_a_signature_without_user_presence_is_refused() public {
        address permissive = address(new PermissiveVerifier());
        vm.prank(owner);
        account.setP256Verifier(permissive);

        bytes memory absent = AUTH_DATA;
        absent[32] = 0x04; // user verified, but not present
        WebAuthn.Signature memory sig =
            WebAuthn.Signature({authenticatorData: absent, clientDataJSON: CLIENT_JSON, r: R, s: S});

        assertFalse(account.isValidPasskeySignature(CREDENTIAL, CHALLENGE, sig));
    }

    /// The mirror image of a valid signature is also valid on the curve, and must not be.
    function test_a_malleable_signature_is_refused() public {
        address permissive = address(new PermissiveVerifier());
        vm.prank(owner);
        account.setP256Verifier(permissive);

        WebAuthn.Signature memory sig = signature();
        sig.s = WebAuthn.HALF_ORDER + 1;

        assertFalse(account.isValidPasskeySignature(CREDENTIAL, CHALLENGE, sig));
    }

    /// With no verifier there is no yes. It must not fail open.
    function test_without_a_verifier_nothing_validates() public {
        vm.prank(owner);
        account.setP256Verifier(address(0));
        assertFalse(account.isValidPasskeySignature(CREDENTIAL, CHALLENGE, signature()));
    }

    // ---- through the entry point ----

    function test_a_passkey_validates_a_user_operation() public {
        PackedUserOperation memory op;
        op.signature = abi.encodePacked(
            bytes1(0x01), abi.encode(CREDENTIAL, AUTH_DATA, CLIENT_JSON, R, S)
        );

        vm.prank(entryPoint);
        assertEq(account.validateUserOp(op, CHALLENGE, 0), 0, "a passkey must be able to drive the account");
    }

    function test_a_passkey_for_the_wrong_operation_does_not_validate() public {
        PackedUserOperation memory op;
        op.signature = abi.encodePacked(
            bytes1(0x01), abi.encode(CREDENTIAL, AUTH_DATA, CLIENT_JSON, R, S)
        );

        vm.prank(entryPoint);
        assertEq(account.validateUserOp(op, keccak256("another operation"), 0), 1);
    }
}
