// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "openzeppelin-contracts/contracts/utils/cryptography/P256.sol";

/**
 * A P-256 verifier at a known address, answering the precompile's calling convention.
 *
 * Sepolia has no RIP-7212 precompile, and the well-known verifier address that carries
 * one on other chains holds something else here — a freshly generated, independently
 * verified signature is rejected by it. So this exists: the same interface, backed by
 * OpenZeppelin's implementation, deployed where we can point at it.
 *
 * Called by staticcall with `abi.encodePacked(hash, r, s, x, y)` — 160 bytes, no selector
 * — and answers with one word. That is deliberately the precompile's shape, so the day
 * Sepolia gains RIP-7212 the account can be pointed at address 0x100 instead and nothing
 * else has to change.
 */
contract P256Verifier {
    fallback(bytes calldata input) external returns (bytes memory) {
        if (input.length != 160) return abi.encode(uint256(0));

        bytes32 hash = bytes32(input[0:32]);
        bytes32 r = bytes32(input[32:64]);
        bytes32 s = bytes32(input[64:96]);
        bytes32 x = bytes32(input[96:128]);
        bytes32 y = bytes32(input[128:160]);

        // `verifySolidity` rather than `verify`, deliberately. `verify` tries the
        // RIP-7212 precompile first, and on a chain without one the empty call can come
        // back looking like a supported-but-invalid answer — which rejects perfectly good
        // signatures, silently. Doing the arithmetic is slower and it is correct.
        //
        // It also rejects the high half of the curve order itself, so a malleable
        // signature does not get a second chance here.
        return abi.encode(P256.verifySolidity(hash, r, s, x, y) ? uint256(1) : uint256(0));
    }
}
