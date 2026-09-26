/**
 * Signing the request World App is about to be asked for.
 *
 * Every proof request has to be signed by the relying party, and the key that does it
 * lives here and only here. If it leaked, anyone could put your app's name on a request —
 * so it is read from the environment, never sent to the browser, and never logged.
 *
 * What goes back to the page is the signature and its window: a nonce, when it was made,
 * and when it stops being valid. Nothing about the person, because at this point nobody
 * has been asked anything yet.
 */
import { signRequest } from '@worldcoin/idkit-core/signing'

const RP_ID = process.env.WORLD_RP_ID
const SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY

export async function POST(request) {
  if (!RP_ID || !SIGNING_KEY) {
    return Response.json(
      { error: 'WORLD_RP_ID and WORLD_RP_SIGNING_KEY are not set' },
      { status: 500 },
    )
  }

  let action
  try {
    ;({ action } = await request.json())
  } catch {
    return Response.json({ error: 'expected json' }, { status: 400 })
  }
  if (!action) return Response.json({ error: 'an action is required' }, { status: 400 })

  // The action is signed along with the nonce, so a signature obtained for one gate
  // cannot be presented at another.
  let signed
  try {
    signed = signRequest({ signingKeyHex: SIGNING_KEY, action })
  } catch (e) {
    // A malformed key fails here rather than three screens later, which is where you
    // would otherwise go looking.
    console.error('[rp-context] could not sign:', e.message)
    return Response.json({ error: `could not sign the request: ${e.message}` }, { status: 500 })
  }

  return Response.json({
    rp_id: RP_ID,
    nonce: signed.nonce,
    created_at: signed.createdAt,
    expires_at: signed.expiresAt,
    signature: signed.sig,
  })
}
