// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Who may verify a login, and what it costs them to lie.
 *
 * A node stakes, publishes a gateway and a per-epoch threshold key, and can be slashed by
 * anyone who shows it attested to a login whose JWT it cannot produce. Unbonding is longer
 * than the registration timelock on purpose: a node cannot sign a forged recovery and
 * withdraw before the challenge window closes.
 */
contract NodeRegistry {
    struct Node {
        address operator;
        uint256 stake;
        string gateway;
        bytes thresholdPubKey;
        uint64 unbondingAt; // zero while active
    }

    mapping(address => Node) public nodes;
    address[] public active;

    event NodeJoined(address indexed operator, uint256 stake);
    event NodeSlashed(address indexed operator, address indexed challenger, uint256 amount);

    function join(string calldata gateway, bytes calldata thresholdPubKey) external payable {}

    function beginUnbonding() external {}

    function withdraw() external {}

    /// Evidence that a committed attestation cannot be backed by the JWT it names.
    function slash(address operator, bytes calldata proof) external {}

    /// The committee for an identity in an epoch, pinned by randomness that was not
    /// available when the request was made.
    function committeeFor(bytes32 seed, uint64 epoch) external view returns (address[] memory) {}
}
