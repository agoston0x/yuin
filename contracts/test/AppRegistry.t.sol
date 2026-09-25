// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AppRegistry} from "../src/AppRegistry.sol";
import {Credentials} from "../src/lib/Credentials.sol";

contract AppRegistryTest is Test {
    AppRegistry registry;

    address dev = address(0xD3F);
    address stranger = address(0x5EE5);
    bytes32 constant APP = keccak256("auction");
    bytes32 constant BID = keccak256("bid");

    function setUp() public {
        registry = new AppRegistry();
        vm.deal(dev, 1 ether);
        vm.deal(stranger, 1 ether);
    }

    function registerApp() internal {
        uint256 stake = registry.MIN_STAKE();
        vm.prank(dev);
        registry.register{value: stake}(APP, "client-id.apps.googleusercontent.com", "https://gw", bytes32(0));
    }

    function kinds(bytes32 a) internal pure returns (bytes32[] memory out) {
        out = new bytes32[](1);
        out[0] = a;
    }

    function kinds(bytes32 a, bytes32 b) internal pure returns (bytes32[] memory out) {
        out = new bytes32[](2);
        out[0] = a;
        out[1] = b;
    }

    function test_registering_records_the_app() public {
        registerApp();
        AppRegistry.App memory app = registry.appOf(APP);
        assertEq(app.owner, dev);
        assertEq(app.aud, "client-id.apps.googleusercontent.com");
        assertEq(registry.appCount(), 1);
    }

    function test_an_app_id_cannot_be_taken_twice() public {
        registerApp();
        uint256 stake = registry.MIN_STAKE();
        vm.prank(stranger);
        vm.expectRevert(AppRegistry.AppExists.selector);
        registry.register{value: stake}(APP, "other", "https://gw", bytes32(0));
    }

    function test_login_policy_is_read_back() public {
        registerApp();
        vm.prank(dev);
        registry.setPolicy(APP, Credentials.LOGIN, kinds(Credentials.GOOGLE, Credentials.WORLD_AGE));

        bytes32[] memory policy = registry.policyFor(APP, Credentials.LOGIN);
        assertEq(policy.length, 2);
        assertEq(policy[0], Credentials.GOOGLE);
        assertEq(policy[1], Credentials.WORLD_AGE);
    }

    /// The demo: the bid gate is empty, then it is not, with nothing redeployed.
    function test_a_step_up_gate_can_be_added_while_the_app_is_live() public {
        registerApp();
        assertEq(registry.policyFor(APP, BID).length, 0);

        vm.prank(dev);
        registry.setPolicy(APP, BID, kinds(Credentials.WORLD_HUMAN));

        bytes32[] memory policy = registry.policyFor(APP, BID);
        assertEq(policy.length, 1);
        assertEq(policy[0], Credentials.WORLD_HUMAN);
    }

    function test_a_gate_can_be_removed_again() public {
        registerApp();
        vm.prank(dev);
        registry.setPolicy(APP, BID, kinds(Credentials.WORLD_HUMAN));
        vm.prank(dev);
        registry.setPolicy(APP, BID, new bytes32[](0));
        assertEq(registry.policyFor(APP, BID).length, 0);
    }

    function test_only_the_owner_may_change_a_policy() public {
        registerApp();
        vm.prank(stranger);
        vm.expectRevert(AppRegistry.NotAppOwner.selector);
        registry.setPolicy(APP, BID, kinds(Credentials.WORLD_HUMAN));
    }

    function test_only_the_owner_may_change_the_records() public {
        registerApp();
        vm.prank(stranger);
        vm.expectRevert(AppRegistry.NotAppOwner.selector);
        registry.update(APP, "stolen", "https://evil", bytes32(uint256(1)));
    }

    function test_an_unregistered_app_has_no_records() public {
        vm.expectRevert(AppRegistry.NoSuchApp.selector);
        registry.appOf(keccak256("nothing"));
    }

    function test_stake_below_the_minimum_is_refused() public {
        vm.prank(dev);
        vm.expectRevert(AppRegistry.StakeTooSmall.selector);
        registry.register{value: 1 wei}(APP, "aud", "https://gw", bytes32(0));
    }

    /// Withdrawing retires the app rather than leaving it half-alive.
    function test_withdrawing_the_stake_removes_the_app() public {
        registerApp();
        uint256 before = dev.balance;

        vm.prank(dev);
        registry.withdrawStake(APP);

        assertEq(dev.balance, before + registry.MIN_STAKE());
        assertFalse(registry.isRegistered(APP));
        vm.expectRevert(AppRegistry.NoSuchApp.selector);
        registry.appOf(APP);
    }
}
