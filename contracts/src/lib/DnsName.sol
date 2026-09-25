// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ENS hands a resolver the name in DNS wire format — each label preceded by its length,
 * terminated by a zero byte. All this needs from it is the first label, which is the part
 * that identifies the app.
 */
library DnsName {
    error MalformedName();

    /// `\x07auction\x03app\x05manju\x03eth\x00` gives back "auction".
    function firstLabel(bytes memory name) internal pure returns (string memory) {
        if (name.length < 2) revert MalformedName();
        uint256 length = uint8(name[0]);
        if (length == 0 || name.length < length + 1) revert MalformedName();

        bytes memory label = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            label[i] = name[i + 1];
        }
        return string(label);
    }
}
