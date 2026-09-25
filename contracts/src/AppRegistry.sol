// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * What a developer registers, and what their users are held to.
 *
 * An app's auth is two lists. The login policy is what someone must present to get in at
 * all. A step-up policy is per action: a named operation — "bid" — that demands a fresh
 * proof even from a user who is already signed in and has been all afternoon.
 *
 * Both are ordinary storage, editable by the developer at any time, and read at the
 * moment of the call rather than baked into a frontend. That is the whole argument: an
 * app tightens its rules by ticking a box, and the next bid is refused without anything
 * being redeployed. It also means the rules are public — the resolver serves them as text
 * records, so a user can read what an app will demand before they sign up.
 *
 * The stake is what makes any of it credible. It lapses, and the records and the ENS name
 * lapse with it.
 */
contract AppRegistry {
    uint256 public constant MIN_STAKE = 0.01 ether;

    struct App {
        address owner;
        uint256 stake;
        string aud; // the OAuth audience this app's users present
        string gateway;
        bytes32 frontendHash; // the frontend allowed to speak for this app
        bool exists;
    }

    mapping(bytes32 => App) internal apps; // appId => app
    mapping(bytes32 => mapping(bytes32 => bytes32[])) internal policies; // appId => action => kinds
    bytes32[] public appIds;

    event AppRegistered(bytes32 indexed appId, address indexed owner, string aud);
    event AppUpdated(bytes32 indexed appId);
    event PolicyChanged(bytes32 indexed appId, bytes32 indexed action, bytes32[] kinds);
    event StakeWithdrawn(bytes32 indexed appId, uint256 amount);

    error StakeTooSmall();
    error AppExists();
    error NoSuchApp();
    error NotAppOwner();
    error TooManyCredentials();

    modifier onlyAppOwner(bytes32 appId) {
        if (!apps[appId].exists) revert NoSuchApp();
        if (apps[appId].owner != msg.sender) revert NotAppOwner();
        _;
    }

    function register(bytes32 appId, string calldata aud, string calldata gateway, bytes32 frontendHash)
        external
        payable
    {
        if (msg.value < MIN_STAKE) revert StakeTooSmall();
        if (apps[appId].exists) revert AppExists();

        apps[appId] = App({
            owner: msg.sender,
            stake: msg.value,
            aud: aud,
            gateway: gateway,
            frontendHash: frontendHash,
            exists: true
        });
        appIds.push(appId);

        emit AppRegistered(appId, msg.sender, aud);
    }

    /// What the EAC role on the app's ENS name is allowed to change, and nothing else.
    function update(bytes32 appId, string calldata aud, string calldata gateway, bytes32 frontendHash)
        external
        onlyAppOwner(appId)
    {
        App storage app = apps[appId];
        app.aud = aud;
        app.gateway = gateway;
        app.frontendHash = frontendHash;
        emit AppUpdated(appId);
    }

    /**
     * Set the credentials required for an action. `Credentials.LOGIN` (zero) is the login
     * policy; anything else is a named action.
     *
     * An empty list is meaningful and allowed: it is how a gate is removed.
     */
    function setPolicy(bytes32 appId, bytes32 action, bytes32[] calldata kinds) external onlyAppOwner(appId) {
        if (kinds.length > 8) revert TooManyCredentials();
        policies[appId][action] = kinds;
        emit PolicyChanged(appId, action, kinds);
    }

    function policyFor(bytes32 appId, bytes32 action) external view returns (bytes32[] memory) {
        return policies[appId][action];
    }

    function appOf(bytes32 appId) external view returns (App memory) {
        if (!apps[appId].exists) revert NoSuchApp();
        return apps[appId];
    }

    function isRegistered(bytes32 appId) external view returns (bool) {
        return apps[appId].exists;
    }

    function appCount() external view returns (uint256) {
        return appIds.length;
    }

    function addStake(bytes32 appId) external payable {
        if (!apps[appId].exists) revert NoSuchApp();
        apps[appId].stake += msg.value;
    }

    /**
     * Taking the stake back retires the app: the records go, and with them the name that
     * resolved from them. There is no half-staked state where an app still looks live.
     */
    function withdrawStake(bytes32 appId) external onlyAppOwner(appId) {
        uint256 amount = apps[appId].stake;
        delete apps[appId];

        emit StakeWithdrawn(appId, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
