// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NodeRegistry} from "../src/NodeRegistry.sol";

contract NodeRegistryTest is Test {
    NodeRegistry registry;

    address alice = address(0xA1);
    address bob = address(0xB0);
    address carol = address(0xCA);

    function setUp() public {
        registry = new NodeRegistry();
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.deal(carol, 1 ether);
    }

    function join(address who) internal {
        uint256 stake = registry.MIN_STAKE();
        vm.prank(who);
        registry.join{value: stake}("https://node.example", hex"00");
    }

    function test_a_node_joins_the_active_set() public {
        join(alice);
        assertTrue(registry.isActive(alice));
        assertEq(registry.activeCount(), 1);
    }

    function test_stake_below_the_minimum_is_refused() public {
        vm.prank(alice);
        vm.expectRevert(NodeRegistry.StakeTooSmall.selector);
        registry.join{value: 1 wei}("https://node.example", hex"00");
    }

    /// Five nodes need three to agree; three need two.
    function test_threshold_is_a_majority() public {
        join(alice);
        assertEq(registry.threshold(), 1);
        join(bob);
        assertEq(registry.threshold(), 2);
        join(carol);
        assertEq(registry.threshold(), 2);
    }

    function test_leaving_drops_the_node_from_the_set_at_once() public {
        join(alice);
        join(bob);
        vm.prank(alice);
        registry.beginUnbonding();

        assertFalse(registry.isActive(alice));
        assertEq(registry.activeCount(), 1);
        assertTrue(registry.isActive(bob));
    }

    function test_stake_cannot_be_withdrawn_during_unbonding() public {
        join(alice);
        vm.prank(alice);
        registry.beginUnbonding();

        vm.prank(alice);
        vm.expectRevert(NodeRegistry.StillUnbonding.selector);
        registry.withdraw();

        vm.warp(block.timestamp + registry.UNBONDING());
        uint256 before = alice.balance;
        vm.prank(alice);
        registry.withdraw();
        assertEq(alice.balance, before + registry.MIN_STAKE());
    }

    function test_an_active_node_cannot_withdraw() public {
        join(alice);
        vm.prank(alice);
        vm.expectRevert(NodeRegistry.StillActive.selector);
        registry.withdraw();
    }

    // ---- equivocation ----

    function signLink(uint256 key, address idRegistry, bytes32 cred, address identity)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(abi.encode("manju/link", block.chainid, idRegistry, cred, identity));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_a_node_that_says_two_things_loses_its_stake() public {
        
        uint256 key = 0x1234;
        address node = vm.addr(key);
        vm.deal(node, 1 ether);
        uint256 stake = registry.MIN_STAKE();
        vm.prank(node);
        registry.join{value: stake}("https://node.example", hex"00");

        address idRegistry = address(0xDEAD);
        bytes32 cred = keccak256("google|1");

        uint256 before = carol.balance;
        vm.prank(carol);
        registry.slashEquivocation(
            node,
            idRegistry,
            cred,
            address(0xAAA),
            signLink(key, idRegistry, cred, address(0xAAA)),
            address(0xBBB),
            signLink(key, idRegistry, cred, address(0xBBB))
        );

        assertFalse(registry.isActive(node));
        assertEq(registry.activeCount(), 0);
        assertEq(carol.balance, before + registry.MIN_STAKE() / 2);
    }

    /// One honest attestation, presented twice, is not a contradiction.
    function test_the_same_attestation_twice_is_not_equivocation() public {
        uint256 key = 0x1234;
        address node = vm.addr(key);
        vm.deal(node, 1 ether);
        uint256 stake = registry.MIN_STAKE();
        vm.prank(node);
        registry.join{value: stake}("https://node.example", hex"00");

        address idRegistry = address(0xDEAD);
        bytes32 cred = keccak256("google|1");
        bytes memory sig = signLink(key, idRegistry, cred, address(0xAAA));

        vm.expectRevert(NodeRegistry.NotEquivocation.selector);
        registry.slashEquivocation(node, idRegistry, cred, address(0xAAA), sig, address(0xAAA), sig);
    }

    /// Someone else's signatures do not convict a node.
    function test_signatures_from_another_node_do_not_slash() public {
        uint256 keyA = 0x1234;
        uint256 keyB = 0x5678;
        address nodeA = vm.addr(keyA);
        vm.deal(nodeA, 1 ether);
        uint256 stake = registry.MIN_STAKE();
        vm.prank(nodeA);
        registry.join{value: stake}("https://node.example", hex"00");

        address idRegistry = address(0xDEAD);
        bytes32 cred = keccak256("google|1");

        vm.expectRevert(NodeRegistry.NotEquivocation.selector);
        registry.slashEquivocation(
            nodeA,
            idRegistry,
            cred,
            address(0xAAA),
            signLink(keyB, idRegistry, cred, address(0xAAA)),
            address(0xBBB),
            signLink(keyB, idRegistry, cred, address(0xBBB))
        );
    }
}
