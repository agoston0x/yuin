// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INodeRegistry} from "./interfaces/INodeRegistry.sol";
import {Sig} from "./lib/Sig.sol";

/**
 * Who may verify a login, and what it costs them to lie.
 *
 * A node puts up a stake, publishes where it can be reached, and joins the active set. A
 * majority of that set has to agree before anything is written to the identity registry,
 * so no node matters much on its own — which is the point.
 *
 * Leaving is deliberately slow. Unbonding runs longer than the window in which a
 * fraudulent attestation can be challenged, so a node cannot sign something false and
 * walk its stake out before anyone notices.
 *
 * What is punishable here is equivocation: two attestations, signed by the same node, that
 * point the same credential at two different identities. That is a contradiction anyone
 * can check on chain with no knowledge of the JWT behind it, and it is exactly the move a
 * colluding quorum would have to make to steal an account. The wider claim — that a
 * quorum must be able to produce the token it attested to — needs data availability and
 * is not enforced here yet; it is stated in the spec as what comes next, not pretended at.
 */
contract NodeRegistry is INodeRegistry {
    uint256 public constant MIN_STAKE = 0.05 ether;
    uint256 public constant UNBONDING = 7 days;

    struct Node {
        uint256 stake;
        string gateway;
        bytes thresholdPubKey;
        uint64 unbondingAt; // zero while active
        uint32 index; // position in `active`, meaningless once unbonding
    }

    mapping(address => Node) public nodes;
    address[] public active;

    /// Slashing pays the challenger half; the rest stays here, unreachable.
    uint256 public constant CHALLENGER_SHARE = 2;

    event NodeJoined(address indexed operator, uint256 stake, string gateway);
    event NodeLeaving(address indexed operator, uint64 withdrawableAt);
    event NodeWithdrew(address indexed operator, uint256 amount);
    event NodeSlashed(address indexed operator, address indexed challenger, uint256 reward);

    error StakeTooSmall();
    error AlreadyJoined();
    error NotANode();
    error StillActive();
    error StillUnbonding();
    error NotEquivocation();

    /**
     * A simple majority of the active set. Five nodes need three, three need two: enough
     * that one operator having a bad day cannot stop a login, and enough that stealing one
     * key does not steal an identity.
     */
    function threshold() external view returns (uint256) {
        return active.length / 2 + 1;
    }

    function isActive(address operator) external view returns (bool) {
        return nodes[operator].stake > 0 && nodes[operator].unbondingAt == 0;
    }

    function activeCount() external view returns (uint256) {
        return active.length;
    }

    function activeSet() external view returns (address[] memory) {
        return active;
    }

    function join(string calldata gateway, bytes calldata thresholdPubKey) external payable {
        if (msg.value < MIN_STAKE) revert StakeTooSmall();
        if (nodes[msg.sender].stake != 0) revert AlreadyJoined();

        nodes[msg.sender] = Node({
            stake: msg.value,
            gateway: gateway,
            thresholdPubKey: thresholdPubKey,
            unbondingAt: 0,
            index: uint32(active.length)
        });
        active.push(msg.sender);

        emit NodeJoined(msg.sender, msg.value, gateway);
    }

    /**
     * Leave the active set now, take the stake later. The node stops being counted
     * immediately — nobody wants attestations from an operator on the way out — but the
     * money stays put until anything it signed has had time to be challenged.
     */
    function beginUnbonding() external {
        Node storage node = nodes[msg.sender];
        if (node.stake == 0) revert NotANode();
        if (node.unbondingAt != 0) revert StillUnbonding();

        _removeFromActive(msg.sender, node.index);
        node.unbondingAt = uint64(block.timestamp + UNBONDING);

        emit NodeLeaving(msg.sender, node.unbondingAt);
    }

    function withdraw() external {
        Node storage node = nodes[msg.sender];
        if (node.stake == 0) revert NotANode();
        if (node.unbondingAt == 0) revert StillActive();
        if (block.timestamp < node.unbondingAt) revert StillUnbonding();

        uint256 amount = node.stake;
        delete nodes[msg.sender];

        emit NodeWithdrew(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }

    /**
     * Proof that a node said two different things about the same credential.
     *
     * The digests are reconstructed here rather than taken on trust, so a challenger
     * cannot invent a pair; both must recover to the accused, and the two identities must
     * actually differ. One honest attestation is never punishable, however unpopular.
     */
    function slashEquivocation(
        address operator,
        address identityRegistry,
        bytes32 credentialHash,
        address identityA,
        bytes calldata signatureA,
        address identityB,
        bytes calldata signatureB
    ) external {
        Node storage node = nodes[operator];
        if (node.stake == 0) revert NotANode();
        if (identityA == identityB) revert NotEquivocation();

        bytes32 digestA = _linkDigest(identityRegistry, credentialHash, identityA);
        bytes32 digestB = _linkDigest(identityRegistry, credentialHash, identityB);
        if (Sig.recover(digestA, signatureA) != operator) revert NotEquivocation();
        if (Sig.recover(digestB, signatureB) != operator) revert NotEquivocation();

        uint256 stake = node.stake;
        if (node.unbondingAt == 0) _removeFromActive(operator, node.index);
        delete nodes[operator];

        uint256 reward = stake / CHALLENGER_SHARE;
        emit NodeSlashed(operator, msg.sender, reward);
        (bool ok,) = msg.sender.call{value: reward}("");
        require(ok, "reward failed");
    }

    /// Mirrors IdentityRegistry.linkDigest — the bytes a node signs when it attests.
    function _linkDigest(address identityRegistry, bytes32 credentialHash, address identity)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode("manju/link", block.chainid, identityRegistry, credentialHash, identity));
    }

    function _removeFromActive(address operator, uint32 index) internal {
        address last = active[active.length - 1];
        active[index] = last;
        nodes[last].index = index;
        active.pop();
        // `operator` is either being deleted or marked unbonding by the caller.
        operator;
    }
}
