# Manju — Spec v5.2

Working title "Manju". Keep the brand out of contract and package names; it lives only in UI, ENS parent and domain.

Decentralized sign-in for ERC-4337 smart accounts. Privy-like UX, no central identity database, no key server, no seed phrase.

This file is spec v5 (the north star) plus the deltas agreed for ETHGlobal Tokyo, marked **[v5.1]** and **[v5.2]**.

**[v5.2] Positioning:** Manju is a friendly identity and access-control layer for consumer apps, not a wallet. A developer picks auth methods and gates (human only, age, MFA, tiered access) in a setup page and writes no auth code. Money features (Uniswap) come second.

---

## Components

**Chain** — v5 targets Arbitrum. **[v5.1] Hackathon: deploy everything on Ethereum Sepolia**, because ENSv2 is only live there and Uniswap liquidity must be tested there. Keep chain config swappable.
- `IdentityRegistry` — `H(iss‖sub‖salt) → identity`. Immutable, write-once per key, no admin. Outlives every app.
  - **[v5.2] Identity, not account:** credentials resolve to one global identity. Accounts hang off it (see Accounts).
  - **[v5.1] Credential mix:** many credential hashes may point to one identity (Google, World, email, passkey). Adding a credential requires a signature from an existing owner. Write-once per credential key still holds.
- `AppRegistry` — dev stake, client_id/`aud`, gateway URL, frontend hash.
  - **[v5.1] Credential policy per app:** `loginCreds` (required at sign-in) and `stepUp[action]` (extra credentials required for a named action, e.g. `bid`). Editable by the staked dev at any time, mirrored to ENS.
  - **[v5.2] Auth method selection:** in the setup page the dev ticks login methods (email OTA, Google; Apple/Meta/GitHub shown as coming soon), a second factor (passkey), recovery (World), and gates (World age, World selfie) at login or per action.
- `NodeRegistry` — node stake (ETH), gateway URL, epoch threshold pubkey, slashing. Unbonding period > timelock.
- `Timelock + multisig` — governs App/Node registries only. Never IdentityRegistry.
- Smart account (ERC-4337) — owner list; session keys with TTL and spend cap.
- **[v5.2] AccountFactory** — CREATE2 per-app accounts from `(identity, appId)`, plus one personal account per identity.

**[v5.2] Accounts**
- One **global identity** per user: verified once (login credentials, World human/age), reused by every Manju app. Recovery lives here.
- One **per-app account** per (identity, app): own keypair and address, derived by CREATE2. Apps cannot correlate users; a compromised app exposes only its own account.
- One **personal account** used by the Manju dashboard to receive and hold funds and top up app accounts.

**Swarm** — static frontends; GSOC as the keyless ephemeral channel for login requests, signature shares, and encrypted JWT blobs.

**ENSv2** — `manju.eth` for protocol discovery (SDK hardcodes this, addresses resolve from it, pinnable override). `<app>.app.manju.eth` wildcard-resolved from AppRegistry; EAC grants the dev a role editing `aud`/`gateway`/`frontendHash` only — non-transferable, revoked when stake lapses. No minting, no per-name gas; the name dies with the stake.
- **[v5.1]** Also expose the credential policy (`loginCreds`, `stepUp`) as text records, so the SDK and anyone can read an app's rules from its name.

**Manju node** — Bee + JWT verifier + chain client, shipped as one Docker container. Staked. Holds no user keys.

---

## Flows

### Signup
1. Page generates `sessionPK`. OAuth with `nonce = H(sessionPK)`.
2. JWT returns to the browser. No backend exists to store it; it is encrypted to the committee and placed on Swarm for the challenge window.
3. Page writes a SOC, POSTs to gateways read from NodeRegistry.
4. Committee — pinned per account/epoch by randomness unavailable at request time — verifies Google's signature, `aud` against AppRegistry, and `nonce == H(sessionPK)`.
5. Each node signs a share over `H(JWT) ‖ sessionPK ‖ intent ‖ appId ‖ expiry`. Shares travel over GSOC, aggregate to one threshold signature, one transaction. (The "commander" only aggregates; it cannot forge.)
6. Contract deploys the account, registers `sessionPK` with TTL and cap, writes IdentityRegistry, starts a long timelock.
7. Blocking prompt: add a passkey and one portable provider.

### Login — device key alive
Session key signs directly. No nodes, no chain write. The common path.

### Login — new device, old device alive
Old owner signs the new key. Instant. No quorum, no timelock.

### Login — everything lost
Signup steps 1–5, then registration as a new owner behind timelock and veto. Same path for World ID recovery.

### Exit
User adds any EOA as an owner and drives the account from MetaMask. Manju out of the loop.

### [v5.1] Step-up verification
1. App calls `sdk.verify(action)`.
2. SDK reads the app's `stepUp[action]` from ENS/AppRegistry.
3. Missing credentials are requested (e.g. World selfie via IDKit), verified server-side or on-chain, then linked to the account's credential mix.
4. Action allowed only when the policy is satisfied. The dev can change the policy live; users are blocked until they meet it.

### [v5.2] Email OTA sign-up (weaker credential)
1. User enters email and a password on the static page.
2. Two independent senders each email a short code: one from Manju's mail service, one from the app's own mail service. Each publishes only `H(code‖email‖nonce)`.
3. User enters both codes; page sends them to the nodes; nodes check both hashes.
4. Identity key = `H(email-issuer‖email‖Argon2(password))`. Manju and the app colluding, without the password, land on a different, empty identity.
5. Then secure with a passkey. Email alone may sign up; it may not recover an identity or add owners.
6. Caveat: the app must run a mail service (and a bare-IP VPS lands in spam). Fallback: a second Manju node sends code two.

---

## Quorum containment

Nodes can collude. They cannot do it quietly.

- Attestation commits to `H(JWT) ‖ sessionPK ‖ intent ‖ appId ‖ expiry`.
- **Challenge:** during the timelock, anyone may challenge a pending registration. The quorum must make the committed JWT available and verifiable. Unavailable, signature invalid, or fields mismatched → stake slashed, registration cancelled.
- Data availability is the security property.
- The `nonce` binding stops key substitution by anyone outside the committee.
- Session keys are capped and expiring. Owner registration is not — a forged recovery grants full control once the timelock passes, which is why veto and challenge carry that path.
- Challenger incentive: a share of slashed stake.
- JWT blobs are encrypted with short `exp`. Swarm chunks lapse with their stamps; confidentiality rests on encryption, not erasure.

---

## Ownership

- Identity mapping: owned by nobody, immutable.
- App records: delegated by role, never transferred, revoked with stake.
- Sessions: self-expiring.
- Upgrades: economics only, behind delay, nodes may exit during the window.

---

## Providers

- **Google** — portable, works now.
- **World ID** — portable; Manju sets the scope, so one identity across all Manju apps. **[v5.1]** Used via IDKit: Passport/NFC (age) and Selfie Check, as login or step-up credentials.
- **Apple / Meta** — per-app subject; recovery only from the app where added. Coming soon.
- **GitHub** — no signed ID token, needs a server. Coming soon.
- **[v5.1] Email** — weaker credential, see Email sign-up.

Every account must have at least one portable recovery path. Enforce it.

---

## [v5.1] Uniswap

SDK embeds the Universal Router (+ Permit2): swap, pay in any token (exact-output swap then transfer), auto-convert on receipt. Story: one identity, one balance, any token, any Manju app. No v4 hooks (new pools have no liquidity).

---

## Holes and caveats

1. Upgrade authority is a single timelocked multisig. Stated publicly.
2. Stake will not exceed TVL early. Fraud proofs and caps carry the security.
3. No independent watchers yet. Manju runs them at launch.
4. Nodes see JWTs. Privacy is optimistic, not cryptographic.
5. Untested: Apple per-app subject scoping; whether an OAuth redirect to a Swarm gateway origin registers with Google. **Test this first.**
6. **[v5.2]** Global identity is correlatable by Manju nodes (they see credentials), not by apps (per-app accounts).
7. **[v5.1]** Passkey is bound to the sign-in page's domain: serve the Swarm page from one fixed domain.

---

## Outlook

**Phase 1** — permissioned nodes, known operators, Manju a minority among them, low caps.
**Phase 2** — permissionless staking, caps rise with stake, slashing live, challengers paid from slashed funds.
**Phase 3** — stake-weighted node governance replaces the multisig.

**ZK-JWT** — on-chain verification replaces the optimistic layer: no disclosed JWT, no watchers, no challenge window. Deferred because in-browser RSA proving is expensive today.

**Permanent caveat:** stake-weighted governance means the largest holder decides.

---

## [v5.2] Repo layout

```
manju/
├─ contracts/        IdentityRegistry, AppRegistry, NodeRegistry, AccountFactory, ENS resolver + EAC (Foundry)
├─ node/             Dockerfile + compose: Bee + manju node (JWT verifier, chain client, GSOC, commander)
├─ signin/           static Swarm sign-in page (email OTA, Google, passkey, World)
├─ sdk/              TS package: login, verify(action), accounts, Uniswap helpers
├─ website/          landing, dev console (stake, pick auth methods and gates), user dashboard (personal account, funds)
├─ mail/             Manju's OTA mail sender
├─ demos/
│  ├─ boilerplate/   how to: integrate, stake, add recovery, MFA, tiered auth
│  ├─ auction/       age to enter, selfie to bid
│  └─ game/          email OTA + passkey, mobile only, selfie
├─ scripts/          deploy, seed nodes, register demo apps
└─ docs/             SPEC.md, DEMO.md, FEEDBACK.md (Uniswap), WORLD_DEBRIEF.md
```
