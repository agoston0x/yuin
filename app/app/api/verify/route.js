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
const RP_ID = process.env.WORLD_RP_ID

export async function POST(request) {
  if (!RP_ID) {
    return Response.json({ ok: false, error: 'WORLD_RP_ID is not set' }, { status: 500 })
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'expected json' }, { status: 400 })
  }

  // developer.world.org is where v4 lives; the old worldcoin.org host serves v2.
  const response = await fetch(`https://developer.world.org/api/v4/verify/${RP_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Forwarded unchanged: remapping fields here is how signatures get broken.
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    // World's own words, rather than a guess at what went wrong.
    return Response.json(
      { ok: false, error: result?.detail ?? result?.code ?? 'World refused the proof', code: result?.code },
      { status: 400 },
    )
  }

  // Whatever World returned, unedited. The nullifier inside is the same value for the
  // same person and the same gate — not an identity, just "this person, for this one".
  return Response.json({ ok: true, result })
}
