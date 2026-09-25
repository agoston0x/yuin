// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ENSIP-10 wildcard resolution for `<app>.app.<root>`, answered out of AppRegistry.
 *
 * No subname is minted and no per-name gas is paid: the name is a view over a record that
 * already exists, which also means the two can never disagree. The policy is exposed as
 * text records, so an app's rules can be read straight from its name by the SDK or by
 * anyone curious.
 *
 * An EAC role lets a developer edit their own `aud`, `gateway` and `frontendHash` and
 * nothing else — non-transferable, and gone when the stake lapses.
 */
contract AppResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {}

    function text(bytes32 node, string calldata key) external view returns (string memory) {}

    function addr(bytes32 node) external view returns (address) {}
}
