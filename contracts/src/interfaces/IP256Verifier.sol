// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * A P-256 signature verifier, called by staticcall with
 * `abi.encodePacked(hash, r, s, x, y)` and answering with a single word: one for valid,
 * zero for not.
 *
 * Two things implement this. RIP-7212 is a precompile at address 0x100 on chains that
 * have adopted it, and it is cheap. Where it does not exist, a Solidity implementation at
 * a known address does the same job for considerably more gas. The account takes the
 * address as configuration so it can use whichever the chain actually has.
 */
interface IP256Verifier {
    function verify(bytes32 hash, uint256 r, uint256 s, uint256 x, uint256 y) external view returns (bool);
}
