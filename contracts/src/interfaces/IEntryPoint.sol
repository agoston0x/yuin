// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ERC-4337 v0.7, declared here rather than pulled in, so this repo builds with one
 * dependency and a reader can see exactly what shape is being validated.
 */
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IAccount4337 {
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}

interface IEntryPoint {
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);

    function depositTo(address account) external payable;
}
