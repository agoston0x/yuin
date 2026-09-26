/**
 * Where a World proof is actually checked.
 *
 * On the server, and only on the server. A proof validated in the browser proves nothing:
 * the page doing the checking is the page that could lie about the result. This hands the
 * payload to World's own verifier and returns a yes or a no.
 *
 * What comes back to the page is the fact of the check and a nullifier — the same value
 * for the same person and the same gate, and nothing else. Not a name, not an age, not a
 * document. An app learns that someone passed, never who they are.
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

  // The shape of what arrives matters enough to record: a proof that was refused and a
  // proof that never had the right fields look identical from the browser.
  console.log('[verify] forwarding keys:', Object.keys(payload ?? {}).join(', '))

  const response = await fetch(`https://developer.world.org/api/v4/verify/${RP_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Forwarded unchanged: remapping fields here is how signatures get broken.
    body: JSON.stringify(payload),
  })

  const raw = await response.text()
  let result
  try {
    result = JSON.parse(raw)
  } catch {
    result = { detail: raw.slice(0, 400) }
  }

  if (!response.ok) {
    // Everything World said, in the logs and in the answer. Guessing at this from a bare
    // 400 is how an afternoon disappears.
    console.error('[verify] world refused', response.status, raw.slice(0, 600))
    return Response.json(
      {
        ok: false,
        status: response.status,
        error: result?.detail ?? result?.code ?? 'World refused the proof',
        code: result?.code,
        world: result,
      },
      { status: 400 },
    )
  }

  console.log('[verify] accepted')

  // A real deployment records the nullifier so one proof cannot be spent twice. Nothing
  // is stored here, because this page is a demonstration and says so.
  return Response.json({ ok: true, result })
}
