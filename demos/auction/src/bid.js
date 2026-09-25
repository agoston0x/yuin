/**
 * Bidding, and being refused.
 *
 * The policy for `bid` is read from the chain at the moment of the click — not at page
 * load, and not baked into this bundle. That is what makes the live change work: the
 * auction house adds a selfie requirement between one bid and the next, and a bidder who
 * has been signed in all afternoon is stopped until they satisfy it.
 *
 * The refusal is the part worth watching. Anyone can demo a success.
 */
export async function attemptBid(client, lot, held = []) {
  const gate = await client.verify('bid', held)
  if (!gate.ok) {
    return {
      allowed: false,
      missing: gate.missing,
      because: `Bidding on ${lot.name} needs ${gate.missing.join(' and ')}.`,
    }
  }
  return { allowed: true }
}

/** What the door asks for, as opposed to what the bid asks for. */
export async function entryPolicy(client) {
  return client.loginPolicy()
}
