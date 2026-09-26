// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64URL} from "./Base64URL.sol";

/**
 * Checking that a passkey signed the thing we asked about.
 *
 * An authenticator does not sign the challenge. It signs
 * `sha256(authenticatorData ‖ sha256(clientDataJSON))`, and the challenge is buried in
 * that JSON. So verifying a passkey means three separate things, and skipping any one of
 * them is a hole:
 *
 *  1. the JSON really does carry our challenge, base64url-encoded — otherwise a signature
 *     collected for one operation authorises another;
 *  2. the user was actually present, per the flags byte — otherwise a key could be
 *     exercised without anyone touching the device;
 *  3. the P-256 signature over that constructed message is valid.
 *
 * `s` is also held to the lower half of the curve order, because every signature has a
 * mirror image and accepting both would let the same approval be replayed as different
 * bytes.
 */
library WebAuthn {
    /// n/2 for the P-256 curve.
    uint256 internal constant HALF_ORDER = 0x7FFFFFFF800000007FFFFFFFFFFFFFFFDE737D56D38BCF4279DCE5617E3192A8;

    /// Bit zero of the flags byte: a person was there.
    bytes1 internal constant USER_PRESENT = 0x01;

    struct Signature {
        bytes authenticatorData;
        string clientDataJSON;
        uint256 r;
        uint256 s;
    }

    /**
     * The message the authenticator actually signed, rebuilt here rather than trusted.
     */
    function signedMessage(bytes memory authenticatorData, string memory clientDataJSON)
        internal
        pure
        returns (bytes32)
    {
        return sha256(abi.encodePacked(authenticatorData, sha256(bytes(clientDataJSON))));
    }

    function carriesChallenge(string memory clientDataJSON, bytes32 challenge) internal pure returns (bool) {
        bytes memory expected = abi.encodePacked('"challenge":"', Base64URL.encode(challenge), '"');
        return Base64URL.contains(bytes(clientDataJSON), expected);
    }

    function userWasPresent(bytes memory authenticatorData) internal pure returns (bool) {
        if (authenticatorData.length < 37) return false;
        return (authenticatorData[32] & USER_PRESENT) == USER_PRESENT;
    }

    /**
     * All three checks, plus the curve one. `verifier` is called by staticcall so a
     * misbehaving verifier cannot alter state on its way to saying yes.
     */
    function verify(Signature memory signature, bytes32 challenge, uint256 x, uint256 y, address verifier)
        internal
        view
        returns (bool)
    {
        if (signature.s > HALF_ORDER) return false;
        if (!userWasPresent(signature.authenticatorData)) return false;
        if (!carriesChallenge(signature.clientDataJSON, challenge)) return false;

        bytes32 message = signedMessage(signature.authenticatorData, signature.clientDataJSON);

        (bool ok, bytes memory result) =
            verifier.staticcall(abi.encodePacked(message, signature.r, signature.s, x, y));

        // A verifier that reverts, or answers with nothing, has not said yes.
        return ok && result.length >= 32 && abi.decode(result, (uint256)) == 1;
    }
}
