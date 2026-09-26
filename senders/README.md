# senders

One service, run twice with different keys. An account is created only when both have
signed for it.

That is not because two mailboxes are safer than one — they are the same mailbox. It is
because two independent operators have to agree, and neither of them holds the password
that actually binds the identity. Collude without it and you create an empty account at
an address nobody will ever fund.

## What it does

- `POST /code` — `{ email }`. Mails a six-digit code. The code goes to the mailbox and
  nowhere else, not even back over this connection.
- `POST /sign` — `{ email, code, identityHash, firstOwner, nonce, expiry }`. A correct
  code buys one signature over exactly what the registry will reconstruct on chain.
- `GET /health` — which sender this is and which key it signs with.

## What it cannot do

Create an account alone. See a password. Reverse an identity hash. Alter what it signs
without invalidating the signature. Keep anything after a code is spent — the store is in
memory, and a restart forgets it.

## Running two

```bash
cp .env.example .env
# SENDER_LABEL=Yuin, SENDER_PRIVATE_KEY=…, PORT=8760
npm start

# and elsewhere, ideally on someone else's machine
# SENDER_LABEL=Acme, SENDER_PRIVATE_KEY=…, PORT=8761
```

Both keys go into `SenderRegistry` on chain. Until they do, their signatures count for
nothing.

## The digest

`keccak(abi.encode("yuin/create-account", chainId, registry, identityHash, firstOwner,
nonce, expiry))` — cross-checked against the contract in `test/sender.test.js`. The chain
id and registry address are inside it, so an approval gathered for one deployment is
worthless at another.
