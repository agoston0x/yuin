// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * The kinds of credential an app can ask for.
 *
 * Kept as hashed names rather than an enum so a new one can be introduced without
 * redeploying anything that reads a policy — the resolver prints whatever string the
 * developer chose, and a client that does not recognise a kind can say so honestly
 * instead of guessing.
 */
library Credentials {
    bytes32 internal constant GOOGLE = keccak256("google");
    bytes32 internal constant EMAIL = keccak256("email");
    bytes32 internal constant PASSKEY = keccak256("passkey");
    bytes32 internal constant WORLD_HUMAN = keccak256("world.selfie");
    bytes32 internal constant WORLD_AGE = keccak256("world.age");

    /// The action id used for the login policy, as opposed to a named action like "bid".
    bytes32 internal constant LOGIN = bytes32(0);
}
