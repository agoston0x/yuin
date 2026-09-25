// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * What a developer registers, and what their users are held to.
 *
 * The policy has two halves. `loginCreds` is what someone must present to sign in at all.
 * `stepUp[action]` is per action: a named operation ("bid") that demands a fresh proof
 * even from a user already signed in. Both are editable while the app is live — the
 * auction demo tightens its bidding policy on stage and the next bid is refused.
 *
 * The stake is what makes the record credible. It lapses, and the app's records and its
 * ENS name lapse with it.
 */
contract AppRegistry {
    struct App {
        address owner;
        uint256 stake;
        string aud; // OAuth audience the app's users present
        string gateway;
        bytes32 frontendHash; // the frontend allowed to speak for this app
    }

    mapping(bytes32 => App) public apps; // appId => app
    mapping(bytes32 => bytes32[]) internal loginCreds; // appId => credential kinds
    mapping(bytes32 => mapping(bytes32 => bytes32[])) internal stepUp; // appId => action => kinds

    event AppRegistered(bytes32 indexed appId, address indexed owner);
    event PolicyChanged(bytes32 indexed appId, bytes32 indexed action);

    function register(bytes32 appId, string calldata aud, string calldata gateway, bytes32 frontendHash)
        external
        payable
    {}

    function setLoginPolicy(bytes32 appId, bytes32[] calldata kinds) external {}

    function setStepUpPolicy(bytes32 appId, bytes32 action, bytes32[] calldata kinds) external {}

    /// `action` of zero means the login policy.
    function policyFor(bytes32 appId, bytes32 action) external view returns (bytes32[] memory kinds) {}
}
