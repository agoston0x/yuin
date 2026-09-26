// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SenderRegistry} from "../src/SenderRegistry.sol";
import {EmailIdentityRegistry} from "../src/EmailIdentityRegistry.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {ISenderRegistry} from "../src/interfaces/ISenderRegistry.sol";
import {IAccountFactory} from "../src/interfaces/IAccountFactory.sol";

/**
 * The pivot path, in dependency order. Deliberately separate from Deploy.s.sol, which
 * still puts up the quorum contracts — neither script knows about the other, and the two
 * systems can stand side by side on the same chain.
 *
 * The two sender addresses are registered here, because a registry with no senders in it
 * cannot create an account and there is nothing to be gained by a second step.
 */
contract DeployPivot is Script {
    /// ERC-4337 v0.7, the same address on every chain.
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address governor = vm.addr(deployerKey);
        address senderOne = vm.envAddress("SENDER_ONE");
        address senderTwo = vm.envAddress("SENDER_TWO");

        vm.startBroadcast(deployerKey);

        SenderRegistry senders = new SenderRegistry(governor);
        senders.add(senderOne);
        senders.add(senderTwo);

        AccountFactory factory = new AccountFactory(ENTRY_POINT, address(0));

        EmailIdentityRegistry identities =
            new EmailIdentityRegistry(ISenderRegistry(address(senders)), IAccountFactory(address(factory)));

        vm.stopBroadcast();

        console.log("SENDER_REGISTRY=%s", address(senders));
        console.log("ACCOUNT_FACTORY=%s", address(factory));
        console.log("EMAIL_IDENTITY_REGISTRY=%s", address(identities));
    }
}
