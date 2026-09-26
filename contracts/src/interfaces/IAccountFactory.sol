// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAccountFactory {
    function personalAddress(bytes32 credentialHash, address firstOwner) external view returns (address);

    function deployPersonal(bytes32 credentialHash, address firstOwner) external returns (address);
}
