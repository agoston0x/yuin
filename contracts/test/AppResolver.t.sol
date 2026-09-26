// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AppRegistry} from "../src/AppRegistry.sol";
import {AppResolver} from "../src/AppResolver.sol";
import {Credentials} from "../src/lib/Credentials.sol";

contract AppResolverTest is Test {
    AppRegistry registry;
    AppResolver resolver;

    address dev = address(0xD3F);
    bytes32 constant APP = keccak256("auction");

    function setUp() public {
        registry = new AppRegistry();
        resolver = new AppResolver(registry);

        vm.deal(dev, 1 ether);
        uint256 stake = registry.MIN_STAKE();
        vm.prank(dev);
        registry.register{value: stake}(APP, "client.apps.googleusercontent.com", "https://gw.example", bytes32(0));

        bytes32[] memory login = new bytes32[](2);
        login[0] = Credentials.GOOGLE;
        login[1] = Credentials.WORLD_AGE;
        vm.prank(dev);
        registry.setPolicy(APP, Credentials.LOGIN, login);
    }

    /// `\x07auction\x03app\x05yuin\x03eth\x00`
    function dnsName() internal pure returns (bytes memory) {
        return hex"0761756374696f6e03617070056d616e6a750365746800";
    }

    function textCall(string memory key) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("text(bytes32,string)", bytes32(0), key);
    }

    function test_records_come_from_the_registry() public view {
        assertEq(resolver.textFor("auction", "yuin.aud"), "client.apps.googleusercontent.com");
        assertEq(resolver.textFor("auction", "yuin.gateway"), "https://gw.example");
    }

    function test_the_login_policy_is_readable_as_text() public view {
        assertEq(resolver.textFor("auction", "yuin.login"), "google,world.age");
    }

    /// A user can see what an app will demand before they agree to it.
    function test_a_step_up_gate_shows_up_under_its_action() public {
        bytes32[] memory kinds = new bytes32[](1);
        kinds[0] = Credentials.WORLD_HUMAN;
        vm.prank(dev);
        registry.setPolicy(APP, keccak256("bid"), kinds);

        assertEq(resolver.textFor("auction", "yuin.stepup.bid"), "world.selfie");
        assertEq(resolver.textFor("auction", "yuin.stepup.withdraw"), "");
    }

    function test_wildcard_resolution_answers_for_the_label() public view {
        bytes memory answer = resolver.resolve(dnsName(), textCall("yuin.aud"));
        assertEq(abi.decode(answer, (string)), "client.apps.googleusercontent.com");
    }

    function test_addr_resolves_to_the_app_owner() public view {
        bytes memory answer = resolver.resolve(dnsName(), abi.encodeWithSignature("addr(bytes32)", bytes32(0)));
        assertEq(abi.decode(answer, (address)), dev);
    }

    function test_an_unregistered_name_holds_no_records() public view {
        assertEq(resolver.textFor("nothing", "yuin.aud"), "");
        assertEq(resolver.ownerOf("nothing"), address(0));
    }

    /// The name and the registry cannot drift: changing the record changes the name.
    function test_changing_the_record_changes_what_the_name_says() public {
        vm.prank(dev);
        registry.update(APP, "new-client-id", "https://gw2.example", bytes32(uint256(7)));

        assertEq(resolver.textFor("auction", "yuin.aud"), "new-client-id");
        assertEq(resolver.textFor("auction", "yuin.gateway"), "https://gw2.example");
    }

    /// Retiring the app takes its name with it.
    function test_withdrawing_the_stake_empties_the_name() public {
        vm.prank(dev);
        registry.withdrawStake(APP);
        assertEq(resolver.textFor("auction", "yuin.aud"), "");
    }

    function test_it_declares_itself_a_wildcard_resolver() public view {
        assertTrue(resolver.supportsInterface(0x9061b923));
    }

    function test_an_unsupported_record_reverts() public {
        vm.expectRevert(AppResolver.UnsupportedCall.selector);
        resolver.resolve(dnsName(), abi.encodeWithSignature("contenthash(bytes32)", bytes32(0)));
    }
}
