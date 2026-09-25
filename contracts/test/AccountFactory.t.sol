// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {SmartAccount} from "../src/SmartAccount.sol";

contract AccountFactoryTest is Test {
    AccountFactory factory;
    address entryPoint = address(0xE417);
    address quorum = address(0x9009);
    address owner = address(0xA11CE);

    bytes32 constant CRED = keccak256("google|12345|salt");
    bytes32 constant AUCTION = keccak256("auction");
    bytes32 constant GAME = keccak256("game");

    function setUp() public {
        factory = new AccountFactory(entryPoint, quorum);
    }

    /// The address is knowable before anything is deployed — that is the entire point.
    function test_the_predicted_address_is_where_it_lands() public {
        address predicted = factory.personalAddress(CRED, owner);
        assertEq(predicted.code.length, 0);

        address deployed = factory.deployPersonal(CRED, owner);
        assertEq(deployed, predicted);
        assertTrue(deployed.code.length > 0);
        assertTrue(SmartAccount(payable(deployed)).isOwner(owner));
    }

    /// Someone can be funded before they have ever signed anything.
    function test_an_undeployed_account_can_hold_funds() public {
        address predicted = factory.personalAddress(CRED, owner);
        vm.deal(address(this), 1 ether);
        (bool ok,) = predicted.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(predicted.balance, 1 ether);

        factory.deployPersonal(CRED, owner);
        assertEq(predicted.balance, 1 ether);
    }

    function test_deploying_twice_is_not_an_error() public {
        address first = factory.deployPersonal(CRED, owner);
        address second = factory.deployPersonal(CRED, owner);
        assertEq(first, second);
    }

    /// Two apps looking at the same person see two unrelated addresses.
    function test_apps_cannot_correlate_the_same_identity() public view {
        address inAuction = factory.appAddress(CRED, AUCTION, owner);
        address inGame = factory.appAddress(CRED, GAME, owner);
        address personal = factory.personalAddress(CRED, owner);

        assertTrue(inAuction != inGame);
        assertTrue(inAuction != personal);
        assertTrue(inGame != personal);
    }

    function test_different_credentials_give_different_accounts() public view {
        address a = factory.personalAddress(CRED, owner);
        address b = factory.personalAddress(keccak256("google|99999|salt"), owner);
        assertTrue(a != b);
    }
}
