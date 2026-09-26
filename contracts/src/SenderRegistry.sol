// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Who is allowed to vouch that an email code came back.
 *
 * Two senders mail two codes, and an account is created only when both have signed for
 * it. This contract is the list of keys whose signatures count — small, boring, and the
 * thing an attacker would have to compromise twice.
 *
 * The honest limitation, stated plainly: the senders can collude. What stops that being
 * fatal is the password, which is stretched in the browser and folded into the identity
 * hash before either sender sees anything. Two colluding senders without the password
 * land on a different identity that holds nothing. They cannot take an account; they can
 * only create an empty one nobody will ever use.
 */
contract SenderRegistry {
    address public governor;
    mapping(address => bool) public isSender;
    uint256 public senderCount;

    event SenderAdded(address indexed sender);
    event SenderRemoved(address indexed sender);
    event GovernorChanged(address indexed governor);

    error NotGovernor();
    error AlreadyRegistered();
    error NotRegistered();
    error ZeroAddress();

    constructor(address governor_) {
        if (governor_ == address(0)) revert ZeroAddress();
        governor = governor_;
        emit GovernorChanged(governor_);
    }

    modifier onlyGovernor() {
        if (msg.sender != governor) revert NotGovernor();
        _;
    }

    function add(address sender) external onlyGovernor {
        if (sender == address(0)) revert ZeroAddress();
        if (isSender[sender]) revert AlreadyRegistered();
        isSender[sender] = true;
        senderCount++;
        emit SenderAdded(sender);
    }

    /**
     * Removing a sender is immediate. A key that has been lost should stop counting the
     * moment anyone notices, and there is nothing here worth a waiting period — an
     * account already created is already created.
     */
    function remove(address sender) external onlyGovernor {
        if (!isSender[sender]) revert NotRegistered();
        isSender[sender] = false;
        senderCount--;
        emit SenderRemoved(sender);
    }

    function setGovernor(address governor_) external onlyGovernor {
        if (governor_ == address(0)) revert ZeroAddress();
        governor = governor_;
        emit GovernorChanged(governor_);
    }
}
