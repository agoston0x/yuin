# The pivot

Nothing was deleted. The quorum path still builds, still passes its tests, and is marked
legacy where it lives. What follows is what moved, and why it was worth moving.

## What was wrong with the old shape

The original design created an account like this: a browser generated a session key, got
an OAuth token bound to it, and posted that to a network of staked nodes. A majority of
those nodes verified the token, each signed an attestation, the shares travelled over
Swarm's GSOC channel, one node aggregated them, and the aggregate went on chain.

It is a good design. Every part of it has an argument behind it, the contracts are
written and tested, and the threat model holds up. It also means that **five machines
have to be alive, funded, synced and reachable before a single person can sign in**.

For a network with operators, that cost is the point — it is what makes the thing
trustless. For a product with no users yet, it is five ways for sign-up to fail before
anyone has tried it. The objection was never cryptographic. It was operational, and it
was fatal at this stage.

## What replaced it

An account is created by **two independent senders agreeing**, and by a password neither
of them holds.

```
identity = keccak(email ‖ argon2id(password))
```

The Argon2 runs in the browser. The email never reaches the chain; the password never
reaches anything. What goes on chain is one hash, and `EmailIdentityRegistry` maps it
write-once to an account.

To create that account, two keys registered in `SenderRegistry` must each sign
`keccak(abi.encode("yuin/create-account", chainId, registry, identityHash, firstOwner,
nonce, expiry))`. Signers must arrive in ascending address order, so one sender signing
twice is rejected in a single pass. The digest expires, and it is consumed on use.

### Why two senders is a real property and not theatre

It would be easy to oversell this. Both codes land in the same inbox, so anyone holding
that inbox gets both — two senders do not protect against a compromised mailbox.

What they protect against is an operator. Neither sender can create an account alone, and
that is the failure mode that matters for a system whose claim is that nobody is in
charge of it.

And the senders colluding is still not enough, because of the password. Two dishonest
senders without it derive a different identity hash, which maps to a different account,
which holds nothing. They can manufacture empty accounts all day. They cannot take yours.

The honest limit: someone with both your email **and** your password has your account,
and no-one can reset it for you. That is the trade — the price of nobody being able to
lock you out is that nobody can let you back in.

## What stayed

- **ERC-4337 smart account**, owner list, session keys with enforced spend caps.
- **AppRegistry**, and policy as a record rather than as code.
- **ENSv2 wildcard resolver** with EAC roles, so an app's rules are readable from its name.
- **A static frontend**, still intended for Swarm. Serving the page from somewhere nobody
  controls survives the pivot intact; it was the *node network*, not decentralised
  hosting, that was in the way.

## What went

- The staked node network and its threshold signing.
- GSOC as a transport between nodes.
- The committee, the commander, and share aggregation.

All of it still in the tree. `IdentityRegistry.sol` and `NodeRegistry.sol` carry a LEGACY
notice; `/node` still builds and its tests still pass.

## The part that is not decentralised, said out loud

**Gas.** A new user has no ether, so a sender broadcasts the creation transaction. The
relayer cannot alter the call — every field is inside the digest both senders signed — so
it can refuse or stall, and nothing else. `createAccount` is permissionless: anyone
holding ether can submit the same transaction instead, which is what keeps this a
convenience rather than a gatekeeper.

**The passkey is not yet an owner.** WebAuthn produces a P-256 key, and verifying P-256
on chain needs RIP-7212 or a Solidity verifier. Sepolia has neither reliably. The
credential is created and stored, and registering it as an owner is marked TODO rather
than faked, because a recovery path that does not work is worse than one that is absent.

**Google is still a server attestation.** Verifying an RSA-signed JWT on chain is
expensive and not yet done. Until it is, that path trusts a server, and says so.

## Where this goes back

The quorum design is not abandoned, it is early. Once there are operators who are not us,
`SenderRegistry` grows from two keys to many and the signature threshold rises with it —
the same shape, reached from the other direction, with users already on the system.
