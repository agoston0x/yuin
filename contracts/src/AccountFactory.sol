// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * CREATE2, so an address exists before the account does — someone can be funded, or sent
 * an NFT, before they have ever signed anything.
 *
 * Two kinds come out of here. A personal account, one per identity, is what the dashboard
 * holds funds in. A per-app account, derived from `(identity, appId)`, is what an app
 * sees: two apps cannot correlate the same user, and an app that is compromised exposes
 * only its own account.
 */
contract AccountFactory {
    event AccountDeployed(address indexed account, address indexed identity, bytes32 indexed appId);

    function personalAddress(address identity) external view returns (address) {}

    function appAddress(address identity, bytes32 appId) external view returns (address) {}

    function deployPersonal(address identity, address firstOwner) external returns (address) {}

    function deployForApp(address identity, bytes32 appId, address firstOwner) external returns (address) {}
}
