// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAccount {
    function isOwner(address owner) external view returns (bool);
}
