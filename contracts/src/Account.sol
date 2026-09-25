// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * An ERC-4337 account with a list of owners rather than one.
 *
 * Owners are permanent and can add each other. Session keys are neither: a browser holds
 * one with an expiry and a spend cap, so the worst a stolen tab can do is bounded and
 * temporary. Adding an EOA as an owner is the exit — from then on the account is drivable
 * from MetaMask and this network is out of the loop.
 */
contract Account {
    struct Session {
        uint64 expiry;
        uint256 spendCap;
        uint256 spent;
    }

    mapping(address => bool) public isOwner;
    mapping(address => Session) public sessions;

    event OwnerAdded(address indexed owner);
    event SessionRegistered(address indexed key, uint64 expiry, uint256 spendCap);

    function addOwner(address owner) external {}

    function registerSession(address key, uint64 expiry, uint256 spendCap) external {}

    /// Valid if an owner signed, or if a live session key signed within its cap.
    function validateUserOp(bytes calldata userOp, bytes32 userOpHash, uint256 missingFunds)
        external
        returns (uint256 validationData)
    {}

    function execute(address to, uint256 value, bytes calldata data) external {}
}
