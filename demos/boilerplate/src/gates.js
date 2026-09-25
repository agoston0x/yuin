/**
 * Gating an action.
 *
 * Nothing about which credentials exist is decided here. The app names an action; the
 * policy for it lives on chain; the answer says what is still missing. A developer who
 * adds a requirement in the console has added it to this app without touching this file.
 *
 * Credentials already linked to the identity would be passed in as `held` — for the demo
 * nothing is held, so every requirement shows up as missing, which is exactly the state
 * worth being able to render.
 */
export async function gateFor(client, action, held = []) {
  return client.verify(action, held)
}

/** Tiered access: the same page, showing more to someone who has done more. */
export async function tierFor(client, held = []) {
  const [basic, full] = await Promise.all([client.verify('view', held), client.verify('view.full', held)])
  if (full.ok) return 'full'
  if (basic.ok) return 'basic'
  return 'none'
}
