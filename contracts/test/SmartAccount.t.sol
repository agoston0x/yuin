// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SmartAccount} from "../src/SmartAccount.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {PackedUserOperation} from "../src/interfaces/IEntryPoint.sol";

contract Target {
    uint256 public hits;

    function ping() external payable {
        hits++;
    }
}

contract AccountTest is Test {
    SmartAccount account;
    address entryPoint = address(0xE417);
    address quorum = address(0x9009);

    uint256 ownerKey = 0xA11CE;
    uint256 sessionKey = 0x5E551;
    uint256 strangerKey = 0xBADBAD;

    address owner;
    address session;

    function setUp() public {
        owner = vm.addr(ownerKey);
        session = vm.addr(sessionKey);
        account = new SmartAccount(entryPoint, quorum, owner);
        vm.deal(address(account), 10 ether);
    }

    function opFor(bytes memory callData, uint256 key, bytes32 hash)
        internal
        pure
        returns (PackedUserOperation memory op)
    {
        op.callData = callData;
        op.signature = sign(key, hash);
    }

    function sign(uint256 key, bytes32 hash) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, hash);
        return abi.encodePacked(r, s, v);
    }

    // ---- ownership ----

    function test_the_first_owner_is_an_owner() public view {
        assertTrue(account.isOwner(owner));
        assertEq(account.ownerCount(), 1);
    }

    function test_an_owner_can_add_another() public {
        vm.prank(owner);
        account.addOwner(address(0xF00D));
        assertTrue(account.isOwner(address(0xF00D)));
    }

    function test_a_stranger_cannot_add_an_owner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(SmartAccount.NotAuthorized.selector);
        account.addOwner(address(0xBEEF));
    }

    function test_the_last_owner_cannot_be_removed() public {
        vm.prank(owner);
        vm.expectRevert(SmartAccount.LastOwner.selector);
        account.removeOwner(owner);
    }

    // ---- recovery ----

    function test_recovery_waits_out_the_delay() public {
        address newOwner = address(0xC0DE);
        vm.prank(quorum);
        account.proposeOwner(newOwner);

        vm.expectRevert(SmartAccount.TooEarly.selector);
        account.completeRecovery(newOwner);

        vm.warp(block.timestamp + account.RECOVERY_DELAY());
        account.completeRecovery(newOwner);
        assertTrue(account.isOwner(newOwner));
    }

    /// The point of the delay: the real owner is awake and says no.
    function test_an_owner_can_veto_a_recovery() public {
        address attacker = address(0xBAD);
        vm.prank(quorum);
        account.proposeOwner(attacker);

        vm.prank(owner);
        account.vetoRecovery(attacker);

        vm.warp(block.timestamp + account.RECOVERY_DELAY());
        vm.expectRevert(SmartAccount.NotPending.selector);
        account.completeRecovery(attacker);
        assertFalse(account.isOwner(attacker));
    }

    function test_only_the_quorum_may_propose() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(SmartAccount.NotAuthorized.selector);
        account.proposeOwner(address(0xBAD));
    }

    // ---- sessions and validation ----

    function test_an_owner_signature_validates() public {
        bytes32 hash = keccak256("op");
        PackedUserOperation memory op = opFor(hex"", ownerKey, hash);
        vm.prank(entryPoint);
        assertEq(account.validateUserOp(op, hash, 0), 0);
    }

    function test_a_stranger_signature_does_not() public {
        bytes32 hash = keccak256("op");
        PackedUserOperation memory op = opFor(hex"", strangerKey, hash);
        vm.prank(entryPoint);
        assertEq(account.validateUserOp(op, hash, 0), 1);
    }

    function test_only_the_entry_point_may_validate() public {
        bytes32 hash = keccak256("op");
        PackedUserOperation memory op = opFor(hex"", ownerKey, hash);
        vm.expectRevert(SmartAccount.NotEntryPoint.selector);
        account.validateUserOp(op, hash, 0);
    }

    function test_a_session_key_validates_within_its_cap() public {
        vm.prank(owner);
        account.registerSession(session, uint64(block.timestamp + 1 hours), 1 ether);

        bytes memory callData = abi.encodeCall(SmartAccount.execute, (address(0x1), 0.5 ether, ""));
        bytes32 hash = keccak256("op");
        vm.prank(entryPoint);
        uint256 data = account.validateUserOp(opFor(callData, sessionKey, hash), hash, 0);
        assertTrue(data != 1);
    }

    /// The cap is enforced here, not by whatever asked for the signature.
    function test_a_session_key_cannot_exceed_its_cap() public {
        vm.prank(owner);
        account.registerSession(session, uint64(block.timestamp + 1 hours), 1 ether);

        bytes memory callData = abi.encodeCall(SmartAccount.execute, (address(0x1), 2 ether, ""));
        bytes32 hash = keccak256("op");
        vm.prank(entryPoint);
        assertEq(account.validateUserOp(opFor(callData, sessionKey, hash), hash, 0), 1);
    }

    function test_spending_accumulates_across_operations() public {
        vm.prank(owner);
        account.registerSession(session, uint64(block.timestamp + 1 hours), 1 ether);

        bytes memory callData = abi.encodeCall(SmartAccount.execute, (address(0x1), 0.6 ether, ""));
        bytes32 hash = keccak256("op");

        vm.prank(entryPoint);
        assertTrue(account.validateUserOp(opFor(callData, sessionKey, hash), hash, 0) != 1);
        vm.prank(entryPoint);
        assertEq(account.validateUserOp(opFor(callData, sessionKey, hash), hash, 0), 1);
    }

    /// Calldata this account cannot reason about spends the whole cap, so it is refused.
    function test_an_unrecognised_call_is_refused_for_a_session_key() public {
        vm.prank(owner);
        account.registerSession(session, uint64(block.timestamp + 1 hours), 1 ether);

        bytes32 hash = keccak256("op");
        vm.prank(entryPoint);
        assertEq(account.validateUserOp(opFor(hex"deadbeef", sessionKey, hash), hash, 0), 1);
    }

    function test_a_revoked_session_stops_working() public {
        vm.prank(owner);
        account.registerSession(session, uint64(block.timestamp + 1 hours), 1 ether);
        vm.prank(owner);
        account.revokeSession(session);

        bytes memory callData = abi.encodeCall(SmartAccount.execute, (address(0x1), 0.1 ether, ""));
        bytes32 hash = keccak256("op");
        vm.prank(entryPoint);
        assertEq(account.validateUserOp(opFor(callData, sessionKey, hash), hash, 0), 1);
    }

    // ---- execution ----

    function test_an_owner_can_execute() public {
        Target target = new Target();
        vm.prank(owner);
        account.execute(address(target), 1 ether, abi.encodeCall(Target.ping, ()));
        assertEq(target.hits(), 1);
        assertEq(address(target).balance, 1 ether);
    }

    function test_a_stranger_cannot_execute() public {
        Target target = new Target();
        vm.prank(address(0xBEEF));
        vm.expectRevert(SmartAccount.NotAuthorized.selector);
        account.execute(address(target), 0, abi.encodeCall(Target.ping, ()));
    }
}
