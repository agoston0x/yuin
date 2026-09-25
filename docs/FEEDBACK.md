# Uniswap — integration feedback

Written while integrating, not afterwards. Friction included.

## What we used it for

Paying a price denominated in one token while holding another, inside a single user
operation. A sake auction quotes lots in a JPY stablecoin; bidders hold USDC; the bid has
to be exact, because an auction that accepts "roughly ¥48,000" is not an auction.

The shape is an exact-output swap, a transfer, and a sweep, sent as three Universal Router
commands in one call from an ERC-4337 account (`sdk/src/uniswap.ts`, used by
`demos/auction/src/pay.js`). Exact-output is what makes it work: it buys precisely what is
owed and returns the change, so the bidder never has to guess how much to swap.

## Notes

- **Exact-output is the right primitive for a priced good, and it is not the one the docs
  lead with.** Most examples are exact-input swaps, which is the right default for trading
  and the wrong one for paying. Finding `V3_SWAP_EXACT_OUT` and learning that its path runs
  backwards — output token first — took longer than writing the encoding.
- **The path direction is a silent failure.** Encode it the familiar way round and the
  call reverts with nothing that names the cause. A one-line note in the command reference
  would have saved us the hour.
- **Sweeping is not optional and is easy to forget.** An exact-output swap leaves change in
  the router. Nothing warns you; the funds are simply not where you expected. We now always
  emit the sweep alongside the swap, but the first version silently left dust behind.
- **From a smart account, Permit2 is the awkward part.** An EOA does an approval and moves
  on. An account that signs user operations has to get the permit signature into the same
  operation as the swap, and the examples assume the EOA case throughout.
- **Chain deployments are hard to pin down.** We ended up making router addresses
  configuration rather than constants, because a hardcoded address that is wrong on a given
  chain is worse than no address at all. A single machine-readable file of deployments per
  chain would remove a whole class of mistake.

## What we wanted and could not do

A quote and a swap in one call, where the quote is binding. We currently quote, then send a
maximum, then hope the ceiling holds — which is fine for an auction, and would not be fine
for something latency-sensitive.

## Time to first successful swap

_Filled in at the event._
