// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NodeRegistry} from "../src/NodeRegistry.sol";
import {AppRegistry} from "../src/AppRegistry.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {AppResolver} from "../src/AppResolver.sol";
import {INodeRegistry} from "../src/interfaces/INodeRegistry.sol";

/**
 * Sepolia, in dependency order. The addresses printed at the end are what goes into the
 * protocol's ENS records — everything else in the system finds them from there rather
 * than being told.
 */
contract Deploy is Script {
    /// ERC-4337 v0.7, the same address on every chain.
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        NodeRegistry nodes = new NodeRegistry();
        AppRegistry apps = new AppRegistry();
        IdentityRegistry identities = new IdentityRegistry(INodeRegistry(address(nodes)));
        AccountFactory factory = new AccountFactory(ENTRY_POINT, address(identities));
        AppResolver resolver = new AppResolver(apps);

        vm.stopBroadcast();

        console.log("NODE_REGISTRY=%s", address(nodes));
        console.log("APP_REGISTRY=%s", address(apps));
        console.log("IDENTITY_REGISTRY=%s", address(identities));
        console.log("ACCOUNT_FACTORY=%s", address(factory));
        console.log("APP_RESOLVER=%s", address(resolver));
    }
}
