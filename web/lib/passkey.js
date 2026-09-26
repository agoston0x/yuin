/**
 * WebAuthn, as a second owner.
 *
 * A passkey is a P-256 keypair the device holds and will not give up. Adding one to an
 * account means the account survives this browser being cleared, which is the difference
 * between a demo and something a person could actually use.
 *
 * On chain this needs a P-256 verifier: RIP-7212 where a chain has it, a Solidity
 * verifier where it does not. Sepolia has neither reliably today, so what happens here is
 * that the credential is created and its public key recorded locally, and registering it
 * as an owner is left as the obvious next step rather than faked.
 */
const STORE = 'yuin.passkey'

export function supported() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

function challenge() {
  return crypto.getRandomValues(new Uint8Array(32))
}

export async function create({ account, label }) {
  if (!supported()) throw new Error('unsupported')

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'Yuin', id: location.hostname },
      user: {
        id: new TextEncoder().encode(account),
        name: label ?? account,
        displayName: label ?? account,
      },
      // P-256 only: it is what an on-chain verifier can check.
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60_000,
      attestation: 'none',
    },
  })

  const publicKey = new Uint8Array(credential.response.getPublicKey())
  const record = {
    id: credential.id,
    account,
    publicKey: Array.from(publicKey),
    // TODO: register as an owner once a P-256 verifier is deployed. Until then this is
    // a credential that exists and is not yet trusted by the account — said plainly
    // rather than presented as done.
    registeredOnChain: false,
  }

  localStorage.setItem(STORE, JSON.stringify(record))
  return record
}

export async function assert() {
  if (!supported()) throw new Error('unsupported')
  const stored = current()

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      rpId: location.hostname,
      allowCredentials: stored ? [{ type: 'public-key', id: fromBase64Url(stored.id) }] : [],
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

export function current() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE) : null
  return raw ? JSON.parse(raw) : null
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
