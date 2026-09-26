# Yuin

Decentralized identity and access control for consumer apps. Trustless, no vendor lock-in, no auth code.

Devs pick sign-in (trustless email OTA or Google, plus a passkey) and tiered gates (human-only, age) in a setup page. Users get a self-custodied web3 identity they can sign with, recoverable with World.

Read [docs/SCOPE.md](docs/SCOPE.md) for what is being built. Built at ETHGlobal Tokyo 2026.

## How an account happens

A static page takes an email address and a password and stretches the password with
Argon2id in the browser. `keccak(email ‖ argon2id(password))` is the identity, and it is
the only thing that leaves the machine — so nobody here can map an identity to an address,
because nobody here has the parts.

Two independent senders each mail a code and each sign for the account. Neither can create
it alone. Both colluding without the password derive a different, empty identity, which is
why the password rather than the mailbox is what actually holds the account.

Then a passkey, so losing the browser is not losing the account.

## Layout

| Path | What it does |
|---|---|
| [contracts](contracts) | Identity and sender registries, the 4337 account and factory, the ENSv2 resolver. |
| [senders](senders) | One service, run twice with different keys. An account needs a signature from each. |
| [web](web) | The landing page and the static sign-up flow. |
| [app](app) | The developer interface: register an app, choose what it asks of its users. |
| [sdk](sdk) | What a developer installs: login, policy checks, balances, swaps. |
| [scripts](scripts) | Deploy, and a harness that exercises the whole path end to end. |
| [docs](docs) | Scope, the pivot, sponsor debriefs. |

Everything before the pivot — the staked node network, GSOC, threshold signing — is on the
`stale` branch with its tests intact. [docs/PIVOT.md](docs/PIVOT.md) says what moved and
why.

## Running it

```bash
# the whole path against a real chain: contracts, two senders, an account created
./scripts/e2e-pivot.sh

cd contracts && forge test
cd senders  && npm install && npm test
cd web      && npm install && npm run build
```

## What we are not claiming

- Someone with your email **and** your password has your account, and nobody can reset it for you. That is the price of nobody being able to lock you out.
- The Google path has no password in it, so it rests on the senders attesting a verified token. On-chain RSA verification removes that; it is not done yet.
- A sender pays the gas for account creation. It cannot alter the call — every field is inside the signed digest — and anyone with ether can submit the same transaction instead.
