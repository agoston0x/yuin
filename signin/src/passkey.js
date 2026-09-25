/**
 * WebAuthn.
 *
 * The credential that keeps working when a provider does not, and the reason the ordinary
 * login touches no nodes and writes nothing to a chain: the passkey signs, the session key
 * is already registered, and the account does the rest.
 *
 * A passkey is bound to an origin, so this page lives at one fixed domain and stays there.
 * Serving it from a different Swarm gateway would silently produce a different credential,
 * which is a failure worth being loud about.
 */
const RP_NAME = 'Manju'

function challenge() {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function supported() {
  return typeof PublicKeyCredential !== 'undefined'
}

export async function create({ identity, label }) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: RP_NAME, id: location.hostname },
      user: {
        id: new TextEncoder().encode(identity),
        name: label ?? identity,
        displayName: label ?? identity,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256, for authenticators that insist
      ],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60_000,
      attestation: 'none',
    },
  })

  return {
    id: credential.id,
    publicKey: new Uint8Array(credential.response.getPublicKey()),
  }
}

export async function assert({ credentialId }) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      rpId: location.hostname,
      allowCredentials: credentialId ? [{ type: 'public-key', id: base64urlToBytes(credentialId) }] : [],
      userVerification: 'preferred',
      timeout: 60_000,
    },
  })
  return {
    id: assertion.id,
    signature: new Uint8Array(assertion.response.signature),
    authenticatorData: new Uint8Array(assertion.response.authenticatorData),
    clientDataJSON: new Uint8Array(assertion.response.clientDataJSON),
  }
}

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
