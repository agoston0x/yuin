// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AppRegistry} from "./AppRegistry.sol";
import {DnsName} from "./lib/DnsName.sol";
import {Credentials} from "./lib/Credentials.sol";

/**
 * ENSIP-10 wildcard resolution for `<app>.app.<root>`, answered out of AppRegistry.
 *
 * No subname is minted and no per-name gas is paid. The name is a view over a record that
 * already exists, which is cheap, but more importantly it means the two can never
 * disagree — there is no second copy of an app's rules to fall out of date.
 *
 * What it serves is the app's policy in plain text. Anyone can read what an app will
 * demand of them before they sign up to it: which credentials to get in, and which extra
 * ones for a named action. A rule that is public is a rule a user can decline in advance.
 *
 * Editing is not done here. The developer changes their records through AppRegistry,
 * where the EAC role limits them to their own `aud`, `gateway` and `frontendHash` — and
 * where the stake lapsing takes the whole record, and therefore this name, with it.
 */
contract AppResolver {
    /// ENSIP-10 IExtendedResolver.
    bytes4 private constant EXTENDED_RESOLVER = 0x9061b923;
    bytes4 private constant TEXT_SELECTOR = bytes4(keccak256("text(bytes32,string)"));
    bytes4 private constant ADDR_SELECTOR = bytes4(keccak256("addr(bytes32)"));

    AppRegistry public immutable registry;

    /// Hashed credential kinds are compact to store and useless to read; this prints them.
    mapping(bytes32 => string) public kindName;

    error UnsupportedCall();

    constructor(AppRegistry registry_) {
        registry = registry_;
        kindName[Credentials.GOOGLE] = "google";
        kindName[Credentials.EMAIL] = "email";
        kindName[Credentials.PASSKEY] = "passkey";
        kindName[Credentials.WORLD_HUMAN] = "world.selfie";
        kindName[Credentials.WORLD_AGE] = "world.age";
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == EXTENDED_RESOLVER || interfaceId == 0x01ffc9a7;
    }

    /**
     * The label is the app. The inner call is re-read here rather than forwarded, because
     * a wildcard resolver is handed a namehash it cannot invert — the name is the only
     * thing that says which app is being asked about.
     */
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        string memory label = DnsName.firstLabel(name);
        bytes4 selector = bytes4(data[:4]);

        if (selector == TEXT_SELECTOR) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(textFor(label, key));
        }
        if (selector == ADDR_SELECTOR) {
            return abi.encode(ownerOf(label));
        }
        revert UnsupportedCall();
    }

    /**
     * The record set. Keys are namespaced so an app can keep its own alongside these:
     *
     *   yuin.aud        the OAuth audience this app's users present
     *   yuin.gateway    where the app wants its users sent
     *   yuin.frontend   the hash of the frontend allowed to speak for it
     *   yuin.login      credentials required to sign in, comma-separated
     *   yuin.stepup.X   credentials required for action X
     *
     * An unregistered app answers with empty strings rather than reverting, because that
     * is what a resolver is expected to do for a name that holds no record.
     */
    function textFor(string memory label, string memory key) public view returns (string memory) {
        bytes32 appId = keccak256(bytes(label));
        if (!registry.isRegistered(appId)) return "";

        AppRegistry.App memory app = registry.appOf(appId);

        if (_eq(key, "yuin.aud")) return app.aud;
        if (_eq(key, "yuin.gateway")) return app.gateway;
        if (_eq(key, "yuin.frontend")) return _hex(app.frontendHash);
        if (_eq(key, "yuin.login")) return _list(registry.policyFor(appId, Credentials.LOGIN));

        bytes memory prefix = bytes("yuin.stepup.");
        bytes memory keyBytes = bytes(key);
        if (keyBytes.length > prefix.length) {
            bool matches = true;
            for (uint256 i = 0; i < prefix.length; i++) {
                if (keyBytes[i] != prefix[i]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                bytes memory action = new bytes(keyBytes.length - prefix.length);
                for (uint256 i = 0; i < action.length; i++) {
                    action[i] = keyBytes[i + prefix.length];
                }
                return _list(registry.policyFor(appId, keccak256(action)));
            }
        }

        return "";
    }

    function ownerOf(string memory label) public view returns (address) {
        bytes32 appId = keccak256(bytes(label));
        if (!registry.isRegistered(appId)) return address(0);
        return registry.appOf(appId).owner;
    }

    // ---- formatting ----

    /// An unknown kind prints as its hash rather than vanishing, so a reader can tell
    /// the difference between "no requirement" and "a requirement I do not recognise".
    function _list(bytes32[] memory kinds) internal view returns (string memory out) {
        for (uint256 i = 0; i < kinds.length; i++) {
            string memory name = kindName[kinds[i]];
            if (bytes(name).length == 0) name = _hex(kinds[i]);
            out = i == 0 ? name : string.concat(out, ",", name);
        }
    }

    function _hex(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            out[2 + i * 2] = alphabet[uint8(value[i]) >> 4];
            out[3 + i * 2] = alphabet[uint8(value[i]) & 0x0f];
        }
        return string(out);
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
