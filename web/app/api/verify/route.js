/**
 * Where a World proof is actually checked.
 *
 * On the server, and only on the server. A proof validated in the browser proves nothing
 * — the page that checked it is the same page that could lie about the answer. This route
 * hands the proof to World's own verifier and returns a yes or a no.
 *
 * What comes back is the fact of the check, never the proof itself: an app downstream
 * cannot replay it anywhere, and nothing here learns who anybody is.
 */
const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID

export async function POST(request) {
  if (!APP_ID || !APP_ID.startsWith('app_')) {
    return Response.json({ ok: false, error: 'NEXT_PUBLIC_WORLD_APP_ID is not set' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'expected json' }, { status: 400 })
  }

  const { proof, merkle_root, nullifier_hash, verification_level, action, signal } = body ?? {}
  if (!proof || !merkle_root || !nullifier_hash || !action) {
    return Response.json({ ok: false, error: 'incomplete proof' }, { status: 400 })
  }

  const response = await fetch(`https://developer.worldcoin.org/api/v2/verify/${APP_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      proof,
      merkle_root,
      nullifier_hash,
      verification_level,
      action,
      signal_hash: signal ?? undefined,
    }),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    // World's own words, rather than a guess at what went wrong.
    return Response.json(
      { ok: false, error: result?.detail ?? result?.code ?? 'World refused the proof', code: result?.code },
      { status: 400 },
    )
  }

  return Response.json({
    ok: true,
    // The nullifier is the same for the same person and the same action, and is the only
    // durable thing here. It is not an identity; it is "this person, for this one gate".
    nullifier: nullifier_hash,
    level: verification_level,
    action,
  })
}
