// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SenderRegistry} from "../src/SenderRegistry.sol";
import {EmailIdentityRegistry} from "../src/EmailIdentityRegistry.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {ISenderRegistry} from "../src/interfaces/ISenderRegistry.sol";
import {IAccountFactory} from "../src/interfaces/IAccountFactory.sol";
import {SmartAccount} from "../src/SmartAccount.sol";

contract EmailIdentityRegistryTest is Test {
    SenderRegistry senders;
    EmailIdentityRegistry registry;
    AccountFactory factory;

    address governor = address(0x600);
    address entryPoint = address(0xE417);

    uint256 yuinKey = 0xA11CE;
    uint256 devKey = 0xB0B;
    uint256 strangerKey = 0xBAD;

    address owner = address(0x0E);
    bytes32 constant IDENTITY = keccak256("alice@example.com|stretched");

    function setUp() public {
        senders = new SenderRegistry(governor);
        factory = new AccountFactory(entryPoint, address(this));
        registry = new EmailIdentityRegistry(
            ISenderRegistry(address(senders)),
            IAccountFactory(address(factory))
        );

        vm.startPrank(governor);
        senders.add(vm.addr(yuinKey));
        senders.add(vm.addr(devKey));
        vm.stopPrank();
    }

    // Signatures must arrive in ascending signer order, so sort the keys by address.
    function bothSignatures(uint256 a, uint256 b, bytes32 digest) internal pure returns (bytes[] memory out) {
        out = new bytes[](2);
        (uint256 lo, uint256 hi) = _order(a, b);
        out[0] = _sign(lo, digest);
        out[1] = _sign(hi, digest);
    }

    function _order(uint256 a, uint256 b) internal pure returns (uint256, uint256) {
        return vmAddr(a) < vmAddr(b) ? (a, b) : (b, a);
    }

    function vmAddr(uint256 key) internal pure returns (address) {
        return vm.addr(key);
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function digestFor(uint256 nonce, uint64 expiry) internal view returns (bytes32) {
        return registry.createDigest(IDENTITY, owner, nonce, expiry);
    }

    function test_two_senders_create_an_account() public {
        uint64 expiry = uint64(block.timestamp + 600);
        address predicted = registry.addressFor(IDENTITY, owner);

        address account = registry.createAccount(
            IDENTITY, owner, 1, expiry, bothSignatures(yuinKey, devKey, digestFor(1, expiry))
        );

        assertEq(account, predicted, "the account must land where it was promised");
        assertEq(registry.accountOf(IDENTITY), account);
        assertTrue(SmartAccount(payable(account)).isOwner(owner));
    }

    /// The whole point of two senders: one is not enough.
    function test_one_signature_is_refused() public {
        uint64 expiry = uint64(block.timestamp + 600);
        bytes[] memory one = new bytes[](1);
        one[0] = _sign(yuinKey, digestFor(1, expiry));

        vm.expectRevert(EmailIdentityRegistry.WrongSignatureCount.selector);
        registry.createAccount(IDENTITY, owner, 1, expiry, one);
    }

    /// And the same sender twice is still one sender.
    function test_the_same_sender_cannot_sign_twice() public {
        uint64 expiry = uint64(block.timestamp + 600);
        bytes32 digest = digestFor(1, expiry);
        bytes[] memory twice = new bytes[](2);
        twice[0] = _sign(yuinKey, digest);
        twice[1] = _sign(yuinKey, digest);

        vm.expectRevert(EmailIdentityRegistry.SignersOutOfOrder.selector);
        registry.createAccount(IDENTITY, owner, 1, expiry, twice);
    }

    function test_a_stranger_is_not_a_sender() public {
        uint64 expiry = uint64(block.timestamp + 600);
        bytes32 digest = digestFor(1, expiry);
        bytes[] memory sigs = bothSignatures(yuinKey, strangerKey, digest);

        vm.expectRevert();
        registry.createAccount(IDENTITY, owner, 1, expiry, sigs);
    }

    function test_an_expired_approval_is_refused() public {
        uint64 expiry = uint64(block.timestamp + 600);
        bytes[] memory sigs = bothSignatures(yuinKey, devKey, digestFor(1, expiry));

        vm.warp(block.timestamp + 601);
        vm.expectRevert(EmailIdentityRegistry.Expired.selector);
        registry.createAccount(IDENTITY, owner, 1, expiry, sigs);
    }

    /// Someone who watched the transaction cannot send it again.
    function test_an_approval_cannot_be_replayed() public {
        uint64 expiry = uint64(block.timestamp + 600);
        bytes[] memory sigs = bothSignatures(yuinKey, devKey, digestFor(1, expiry));
        registry.createAccount(IDENTITY, owner, 1, expiry, sigs);

        vm.expectRevert(EmailIdentityRegistry.AlreadyExists.selector);
        registry.createAccount(IDENTITY, owner, 1, expiry, sigs);
    }

    /// An identity belongs to one account, permanently.
    function test_an_identity_cannot_be_recreated_elsewhere() public {
        uint64 expiry = uint64(block.timestamp + 600);
        registry.createAccount(IDENTITY, owner, 1, expiry, bothSignatures(yuinKey, devKey, digestFor(1, expiry)));

        uint64 later = uint64(block.timestamp + 1200);
        bytes32 digest = registry.createDigest(IDENTITY, address(0xDEAD), 2, later);
        vm.expectRevert(EmailIdentityRegistry.AlreadyExists.selector);
        registry.createAccount(IDENTITY, address(0xDEAD), 2, later, bothSignatures(yuinKey, devKey, digest));
    }

    /// A signature for one owner does not create an account for another.
    function test_signatures_are_bound_to_the_owner() public {
        uint64 expiry = uint64(block.timestamp + 600);
        bytes[] memory sigs = bothSignatures(yuinKey, devKey, digestFor(1, expiry));

        vm.expectRevert();
        registry.createAccount(IDENTITY, address(0xDEAD), 1, expiry, sigs);
    }

    function test_a_removed_sender_stops_counting() public {
        vm.prank(governor);
        senders.remove(vm.addr(devKey));

        uint64 expiry = uint64(block.timestamp + 600);
        bytes[] memory sigs = bothSignatures(yuinKey, devKey, digestFor(1, expiry));

        vm.expectRevert();
        registry.createAccount(IDENTITY, owner, 1, expiry, sigs);
    }

    function test_only_the_governor_manages_senders() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(SenderRegistry.NotGovernor.selector);
        senders.add(address(0x1234));
    }
}
