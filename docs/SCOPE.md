# Scope

What is being built, what is deliberately not, and what has to exist outside the repo for
any of it to run. Everything prior to this lives on the `stale` branch.

## The product

A developer sets up identity for their users in one interface. Their users get a keypair
and a smart account that nobody — including us — can map back to them or lock them out
of.

## The two ways in

**Email, private.** A static page takes an email address and a password, stretches the
password with Argon2id in the browser, and produces `keccak(email ‖ argon2id(password))`.
Only that hash leaves the machine. Two independent senders each mail a code and each sign
for the account; neither can create it alone, and both colluding without the password
derive a different, empty identity. Yuin cannot map an identity to an address because
Yuin never had the parts.

**Google, convenient.** Faster, one click, and it rests on Google plus the senders
attesting a verified token. Weaker, and labelled as such on the page rather than in a
footnote.

Either way the user is then prompted to secure the account with a passkey, which is the
thing that makes "you can always get back in" true rather than aspirational.

## The account

ERC-4337, owner list rather than a single owner, session keys with spend caps the account
enforces. A passkey is a real owner: WebAuthn P-256 verified on chain.

Uniswap is built in, so the account behaves like a wallet rather than a puzzle:

- swap held tokens
- auto-convert enough of something into gas when there is no ether
- pay in token A while the price is in token B, inside one operation
- plain manual swaps, for when someone just wants to swap

## The app registry

An app registers on ENSv2 and its record says, publicly, which methods it asks of its
users — email, Google, passkey, and the proofs it may add later. Anyone can read what an
app will demand before signing up to it. World's age and personhood checks are the obvious
next entries; integrated if there is time, marked coming soon if not.

## The demos

1. **A game for two.** Set up through the Yuin interface using Google. Two people play
   for tokens, auto-swapped by Uniswap so neither has to hold the right one first.
2. **A manual swap**, in the account itself.

## What has to exist outside the repo

| Thing | Why |
|---|---|
| Resend domain for Yuin | one of the two senders |
| Resend domain for the demo app | the other sender, run by someone else |
| Sepolia deployment | registries, factory, account, resolver |
| P-256 verifier on Sepolia | passkeys are not owners without it |
| ENSv2 name | the app registry resolves from it |
| Testnet USDC and a funded pool | the game stakes and the swap demo both die without depth |
| Two sender services running | an account needs a signature from each |
| Yuin interface hosted | the developer-facing setup surface |
| Static sign-up page on Swarm | the page nobody operates |

## Not in scope

The staked node network, GSOC transport, committee and threshold signing. It was sound
and it needed five machines alive before one person could sign in. It is on `stale`, with
its tests, and the reasoning is in [PIVOT.md](PIVOT.md).
