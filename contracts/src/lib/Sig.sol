// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Signature recovery, without a dependency.
 *
 * Two rules beyond `ecrecover`: reject the high half of the curve order, because every
 * signature has a mirror image and accepting both would let the same approval be
 * submitted twice under two different bytes; and reject the zero address, which is what
 * `ecrecover` returns instead of reverting when it cannot recover anything.
 */
library Sig {
    error BadSignature();

    function recover(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) revert BadSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert BadSignature();
        }
        if (v != 27 && v != 28) revert BadSignature();

        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
