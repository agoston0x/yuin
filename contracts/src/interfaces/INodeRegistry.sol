// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INodeRegistry {
    function isActive(address operator) external view returns (bool);

    function threshold() external view returns (uint256);
}
