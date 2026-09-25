// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {INodeRegistry} from "../src/interfaces/INodeRegistry.sol";
import {Sig} from "../src/lib/Sig.sol";

contract FakeNodes is INodeRegistry {
    mapping(address => bool) public active;
    uint256 public threshold = 3;

    function setActive(address who, bool yes) external {
        active[who] = yes;
    }

    function isActive(address who) external view returns (bool) {
        return active[who];
    }
}

contract FakeAccount {
    mapping(address => bool) public isOwner;

    function setOwner(address who, bool yes) external {
        isOwner[who] = yes;
    }
}

contract IdentityRegistryTest is Test {
    IdentityRegistry registry;
    FakeNodes nodes;

    bytes32 constant CRED = keccak256("google|12345|salt");
    address identity = address(0xBEEF);

    // Sorted ascending, because the registry requires signers in order.
    uint256[] nodeKeys;

    function setUp() public {
        nodes = new FakeNodes();
        registry = new IdentityRegistry(INodeRegistry(address(nodes)));

        uint256[] memory keys = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            keys[i] = 0x1000 + i;
            nodes.setActive(vm.addr(keys[i]), true);
        }
        // insertion sort by address
        for (uint256 i = 0; i < 5; i++) {
            uint256 k = keys[i];
            uint256 j = i;
            while (j > 0 && vm.addr(nodeKeys[j - 1]) > vm.addr(k)) {
                if (j == nodeKeys.length) nodeKeys.push(nodeKeys[j - 1]);
                else nodeKeys[j] = nodeKeys[j - 1];
                j--;
            }
            if (j == nodeKeys.length) nodeKeys.push(k);
            else nodeKeys[j] = k;
        }
    }

    function signLink(uint256[] memory keys, bytes32 cred, address id) internal view returns (bytes[] memory) {
        bytes32 digest = registry.linkDigest(cred, id);
        bytes[] memory sigs = new bytes[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }
        return sigs;
    }

    function firstN(uint256 n) internal view returns (uint256[] memory out) {
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = nodeKeys[i];
        }
    }

    function test_quorum_links_a_new_credential() public {
        registry.link(CRED, identity, signLink(firstN(3), CRED, identity));
        assertEq(registry.identityOf(CRED), identity);
    }

    function test_a_credential_cannot_be_relinked() public {
        registry.link(CRED, identity, signLink(firstN(3), CRED, identity));
        bytes[] memory sigs = signLink(firstN(3), CRED, address(0xCAFE));
        vm.expectRevert(IdentityRegistry.AlreadyLinked.selector);
        registry.link(CRED, address(0xCAFE), sigs);
    }

    function test_two_signers_are_not_enough() public {
        bytes[] memory sigs = signLink(firstN(2), CRED, identity);
        vm.expectRevert(IdentityRegistry.NotEnoughSigners.selector);
        registry.link(CRED, identity, sigs);
    }

    /// The same node signing three times must not pass for three nodes.
    function test_the_same_signer_cannot_fill_the_quorum() public {
        uint256[] memory repeated = new uint256[](3);
        repeated[0] = nodeKeys[0];
        repeated[1] = nodeKeys[0];
        repeated[2] = nodeKeys[0];
        bytes[] memory sigs = signLink(repeated, CRED, identity);
        vm.expectRevert(IdentityRegistry.SignersOutOfOrder.selector);
        registry.link(CRED, identity, sigs);
    }

    function test_a_stranger_cannot_stand_in_for_a_node() public {
        uint256[] memory keys = firstN(3);
        keys[2] = 0xDEAD; // not registered
        // resort: the stranger's address may fall anywhere, so sign with a set we sort here
        bytes32 digest = registry.linkDigest(CRED, identity);
        address[] memory addrs = new address[](3);
        for (uint256 i = 0; i < 3; i++) {
            addrs[i] = vm.addr(keys[i]);
        }
        // put them in ascending order
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = i + 1; j < 3; j++) {
                if (addrs[j] < addrs[i]) {
                    (addrs[i], addrs[j]) = (addrs[j], addrs[i]);
                    (keys[i], keys[j]) = (keys[j], keys[i]);
                }
            }
        }
        bytes[] memory sigs = new bytes[](3);
        for (uint256 i = 0; i < 3; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }
        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.NotANode.selector, vm.addr(0xDEAD)));
        registry.link(CRED, identity, sigs);
    }

    /// An attestation gathered for one identity must not move to another.
    function test_signatures_do_not_transfer_to_another_identity() public {
        bytes[] memory sigs = signLink(firstN(3), CRED, identity);
        // Recovered against a different digest, these yield addresses nobody registered.
        vm.expectRevert();
        registry.link(CRED, address(0xFACE), sigs);
        assertEq(registry.identityOf(CRED), address(0));
    }

    function test_owner_can_add_a_second_credential() public {
        FakeAccount account = new FakeAccount();
        uint256 ownerKey = 0xA11CE;
        account.setOwner(vm.addr(ownerKey), true);

        bytes32 second = keccak256("world|nullifier");
        bytes32 digest = registry.ownerLinkDigest(second, address(account), 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);

        registry.linkWithOwner(second, address(account), abi.encodePacked(r, s, v));
        assertEq(registry.identityOf(second), address(account));
        assertEq(registry.nonceOf(address(account)), 1);
    }

    function test_a_non_owner_cannot_add_a_credential() public {
        FakeAccount account = new FakeAccount();
        uint256 strangerKey = 0xBAD;

        bytes32 second = keccak256("world|nullifier");
        bytes32 digest = registry.ownerLinkDigest(second, address(account), 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(strangerKey, digest);

        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.NotAnOwner.selector, vm.addr(strangerKey)));
        registry.linkWithOwner(second, address(account), abi.encodePacked(r, s, v));
    }

    /// Nonce consumed: the same owner signature cannot be used for a second credential.
    function test_owner_signature_cannot_be_replayed() public {
        FakeAccount account = new FakeAccount();
        uint256 ownerKey = 0xA11CE;
        account.setOwner(vm.addr(ownerKey), true);

        bytes32 second = keccak256("world|nullifier");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, registry.ownerLinkDigest(second, address(account), 0));
        bytes memory sig = abi.encodePacked(r, s, v);
        registry.linkWithOwner(second, address(account), sig);

        bytes32 third = keccak256("passkey|abc");
        vm.expectRevert();
        registry.linkWithOwner(third, address(account), sig);
    }
}
