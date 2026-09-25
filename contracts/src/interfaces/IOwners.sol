// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// The one thing other contracts need to ask an account.
interface IOwners {
    function isOwner(address owner) external view returns (bool);
}
