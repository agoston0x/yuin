/**
 * Google, in the implicit form: ask for an `id_token` directly and get it back in the URL
 * fragment. No code exchange, which means no client secret, which means no server — the
 * page can be static, which is the point of the whole exercise.
 *
 * The nonce is not decoration. Google signs it into the token, and every node checks it
 * against the session key being registered.
 */
import { nonceFor } from './session.js'

export function redirectToGoogle({ clientId, session, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce: nonceFor(session.publicKey),
    state: state ?? '',
    prompt: 'select_account',
  })
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** The token arrives in the fragment, which never reaches a server. Read it and clear it. */
export function tokenFromCallback() {
  if (!location.hash) return null
  const params = new URLSearchParams(location.hash.slice(1))
  const token = params.get('id_token')
  if (!token) return null

  history.replaceState(null, '', location.pathname + location.search)
  return { token, state: params.get('state') ?? '' }
}
