// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISenderRegistry {
    function isSender(address sender) external view returns (bool);

    function senderCount() external view returns (uint256);
}
