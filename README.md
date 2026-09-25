# Manju

Decentralized identity and access control for consumer apps. Trustless, no vendor lock-in, no auth code.

Devs pick sign-in (trustless email OTA or Google, plus a passkey) and tiered gates (human-only, age) in a setup page. Users get a self-custodied web3 identity they can sign with, recoverable with World.

See [docs/SPEC.md](docs/SPEC.md). Built at ETHGlobal Tokyo 2026.

## What is actually here

| Path | What it does |
|---|---|
| [contracts](contracts) | Three registries, the account and factory, an ENSv2 wildcard resolver. 60 tests. |
| [node](node) | The staked verifier: checks a provider's token, signs a share, exchanges shares over GSOC. |
| [signin](signin) | The static sign-in page. Google, passkey, World, email codes. Served from Swarm. |
| [sdk](sdk) | What a developer installs: `login()`, `verify(action)`, balances, Uniswap helpers. |
| [website](website) | Landing, the developer console, the user dashboard. |
| [mail](mail) | One of the two independent senders behind email codes. |
| [demos](demos) | A boilerplate app, the sake auction, the game. |
| [scripts](scripts) | Deploy, stake the node set, register the demo apps, upload the sign-in page. |

## The idea in one paragraph

A credential is a salted hash on chain — `keccak(issuer ‖ subject ‖ salt)` — pointing at an
account. Nobody holds the other half, so nobody can turn an address back into a person. A
majority of staked nodes has to agree before a credential is written, and each of them
signs a commitment to the token they verified, so a node that attests to two different
things about the same credential can be slashed by anyone who notices. What an app requires
of its users is a record, not code: tick a box in the console and the next call obeys it.

## Running it

```bash
# contracts
cd contracts && forge test && forge build

# the node set (each node is Bee + verifier + a mail sender)
cd node && cp .env.example .env   # fill it in
docker compose up

# the pieces that run in a browser
cd signin  && npm install && npm run build
cd website && npm install && npm run build
cd demos/auction && npm install && npm run build
```

Deployment, in order: `scripts/deploy.sh`, then `scripts/seed-nodes.sh`, then
`scripts/register-apps.sh`, then `scripts/upload-signin.sh`. Each reads
`scripts/.env` (see `.env.example`) and the addresses the previous one wrote.

## What we are not claiming

- Nodes see the provider's token while verifying it. Privacy here is optimistic, not cryptographic; ZK-JWT removes that and is deferred, not pretended.
- A targeted attacker who already knows someone's provider subject can confirm a guess against the registry. The salt raises the cost of a sweep; it is not a secret.
- The node set is small and known. The registry and the slashing are what make it open later — today it is reputation.
- IDKit needs a backend to sign `rp_context`, and that is us. We are a credential issuer, not a mapping holder, and every account is required to carry a second portable recovery path.

The full list is in the spec, under [Holes and caveats](docs/SPEC.md).
