// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SmartAccount} from "./SmartAccount.sol";

/**
 * CREATE2, so an address exists before the account does. Someone can be funded, or sent
 * an NFT, before they have ever signed anything — which is how a new user's first
 * experience can be "you already have money" rather than "first, a transaction".
 *
 * Two kinds come out of here. The personal account, one per identity, is what the
 * dashboard holds funds in. A per-app account is derived from `(identity, appId)`, so the
 * same person appears at a different address in every app they use: two apps comparing
 * notes learn nothing, and an app that is compromised exposes only its own account.
 */
contract AccountFactory {
    address public immutable entryPoint;
    address public immutable quorum;

    event AccountDeployed(address indexed account, bytes32 indexed identityKey, bytes32 indexed appId);

    constructor(address entryPoint_, address quorum_) {
        entryPoint = entryPoint_;
        quorum = quorum_;
    }

    /// The personal account for a credential — the identity's own address, before any app.
    function personalAddress(bytes32 credentialHash, address firstOwner) public view returns (address) {
        return _addressFor(_salt(credentialHash, bytes32(0)), firstOwner);
    }

    function appAddress(bytes32 credentialHash, bytes32 appId, address firstOwner) public view returns (address) {
        return _addressFor(_salt(credentialHash, appId), firstOwner);
    }

    function deployPersonal(bytes32 credentialHash, address firstOwner) external returns (address) {
        return _deploy(credentialHash, bytes32(0), firstOwner);
    }

    function deployForApp(bytes32 credentialHash, bytes32 appId, address firstOwner) external returns (address) {
        return _deploy(credentialHash, appId, firstOwner);
    }

    /// Deploying twice is not an error — the address was always going to be the same one.
    function _deploy(bytes32 credentialHash, bytes32 appId, address firstOwner) internal returns (address) {
        bytes32 salt = _salt(credentialHash, appId);
        address predicted = _addressFor(salt, firstOwner);
        if (predicted.code.length > 0) return predicted;

        SmartAccount account = new SmartAccount{salt: salt}(entryPoint, quorum, firstOwner);
        emit AccountDeployed(address(account), credentialHash, appId);
        return address(account);
    }

    function _salt(bytes32 credentialHash, bytes32 appId) internal pure returns (bytes32) {
        return keccak256(abi.encode(credentialHash, appId));
    }

    function _addressFor(bytes32 salt, address firstOwner) internal view returns (address) {
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(SmartAccount).creationCode, abi.encode(entryPoint, quorum, firstOwner))
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
