// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Base64url, because WebAuthn puts the challenge in JSON that way.
 *
 * The browser writes `{"type":"webauthn.get","challenge":"<base64url>",...}` and signs
 * over those exact bytes. To know the signature is about *our* operation and not some
 * other one, the contract has to encode the hash the same way and find it in there.
 */
library Base64URL {
    bytes internal constant ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    /// No padding, which is what WebAuthn omits.
    function encode(bytes32 value) internal pure returns (string memory) {
        bytes memory table = ALPHABET;
        // 32 bytes is 256 bits; 43 base64 characters carry 258, so the last one is partial.
        bytes memory out = new bytes(43);

        uint256 i;
        uint256 j;
        for (; i + 3 <= 32; i += 3) {
            uint256 chunk = (uint256(uint8(value[i])) << 16) | (uint256(uint8(value[i + 1])) << 8)
                | uint256(uint8(value[i + 2]));
            out[j++] = table[(chunk >> 18) & 0x3f];
            out[j++] = table[(chunk >> 12) & 0x3f];
            out[j++] = table[(chunk >> 6) & 0x3f];
            out[j++] = table[chunk & 0x3f];
        }

        // 32 is not a multiple of three: two bytes are left, giving three characters.
        uint256 tail = (uint256(uint8(value[30])) << 8) | uint256(uint8(value[31]));
        out[j++] = table[(tail >> 10) & 0x3f];
        out[j++] = table[(tail >> 4) & 0x3f];
        out[j] = table[(tail << 2) & 0x3f];

        return string(out);
    }

    /// Is `needle` somewhere in `haystack`. Small inputs; clarity beats cleverness.
    function contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length == 0 || needle.length > haystack.length) return false;

        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool same = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    same = false;
                    break;
                }
            }
            if (same) return true;
        }
        return false;
    }
}
