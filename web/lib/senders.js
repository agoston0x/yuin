/**
 * Talking to the two senders.
 *
 * They are the only services this page contacts, and neither can do anything alone. If
 * one is down, sign-up stops — which is the honest cost of requiring two, and cheaper
 * than the alternative of trusting one.
 */
const SENDERS = (process.env.NEXT_PUBLIC_SENDERS || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

export function configured() {
  return SENDERS.length === 2
}

export function endpoints() {
  return SENDERS
}

async function post(url, path, body) {
  const response = await fetch(new URL(path, url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `${url} refused`)
  return data
}

/** Both at once: two codes arrive in the same inbox, moments apart. */
export async function requestCodes(email) {
  return Promise.all(SENDERS.map((url) => post(url, '/code', { email })))
}

/**
 * One code per sender, one signature each. Order matters later — the registry wants
 * signers in ascending address order — so the signer address comes back with each.
 */
export async function collectSignatures({ email, codes, identityHash, firstOwner, nonce, expiry }) {
  const results = await Promise.all(
    SENDERS.map((url, i) =>
      post(url, '/sign', { email, code: codes[i], identityHash, firstOwner, nonce, expiry }),
    ),
  )

  return results
    .map((r) => ({ signature: r.signature, signer: r.signer.toLowerCase() }))
    .sort((a, b) => (a.signer < b.signer ? -1 : 1))
    .map((r) => r.signature)
}

/** Either sender will broadcast it; the first to answer wins. */
export async function relay(payload) {
  return Promise.any(SENDERS.map((url) => post(url, '/relay', payload))).catch((error) => {
    const reasons = error.errors?.map((e) => e.message).join('; ') ?? error.message
    throw new Error(reasons)
  })
}
