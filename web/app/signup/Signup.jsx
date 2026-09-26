'use client'

/**
 * Sign-up, in four steps the user can actually follow.
 *
 * Email and password, two codes, an account, a passkey. The interesting work happens
 * between the first and second step and is invisible: the password is stretched with
 * Argon2id in this tab, and the result is folded into an identity hash that neither
 * sender nor chain can reverse.
 *
 * The page is honest about what it is waiting for at each point, because "loading" for
 * two seconds while Argon2 runs looks identical to "broken".
 */
import { useState } from 'react'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { deriveIdentity } from '../../lib/identity'
import * as owner from '../../lib/owner'
import * as senders from '../../lib/senders'
import * as passkey from '../../lib/passkey'

const REGISTRY = process.env.NEXT_PUBLIC_EMAIL_IDENTITY_REGISTRY
const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'

const registryAbi = [
  {
    type: 'function',
    name: 'addressFor',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'accountOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
]

const client = createPublicClient({ chain: sepolia, transport: http(RPC) })

export default function Signup() {
  const [step, setStep] = useState('start')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState(['', ''])
  const [identity, setIdentity] = useState(null)
  const [account, setAccount] = useState(null)
  const [tx, setTx] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const ready = Boolean(REGISTRY) && senders.configured()

  async function begin(event) {
    event.preventDefault()
    setError('')
    try {
      if (password.length < 10) throw new Error('use at least ten characters — this is the whole security of it')

      // Argon2 takes a second or two on purpose, so say so rather than appearing stuck.
      setBusy('Stretching your password. This is meant to be slow.')
      const derived = await deriveIdentity({ email, password })
      const first = owner.loadOrCreate()

      setBusy('Checking whether this account already exists…')
      const existing = await client.readContract({
        address: REGISTRY,
        abi: registryAbi,
        functionName: 'accountOf',
        args: [derived.identityHash],
      })

      if (existing !== '0x0000000000000000000000000000000000000000') {
        setIdentity({ ...derived, owner: first })
        setAccount(existing)
        setStep('exists')
        return
      }

      const predicted = await client.readContract({
        address: REGISTRY,
        abi: registryAbi,
        functionName: 'addressFor',
        args: [derived.identityHash, first.address],
      })

      setBusy('Asking both senders for a code…')
      await senders.requestCodes(email)

      setIdentity({ ...derived, owner: first, predicted })
      setStep('codes')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  async function finish(event) {
    event.preventDefault()
    setError('')
    try {
      const nonce = Date.now()
      const expiry = Math.floor(Date.now() / 1000) + 600

      setBusy('Collecting a signature from each sender…')
      const signatures = await senders.collectSignatures({
        email,
        codes,
        identityHash: identity.identityHash,
        firstOwner: identity.owner.address,
        nonce,
        expiry,
      })

      setBusy('Creating the account on chain…')
      const result = await senders.relay({
        identityHash: identity.identityHash,
        firstOwner: identity.owner.address,
        nonce,
        expiry,
        signatures,
      })

      setAccount(result.account)
      setTx(result.tx ?? null)
      setStep('passkey')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  /**
   * Until this happens the account rests on one key in one browser. That is a bad place
   * to leave someone, so the flow is not finished until there is a second way in.
   */
  async function addPasskey() {
    setError('')
    try {
      setBusy('Waiting for your device…')
      await passkey.create({ account, label: email })
      setStep('done')
    } catch (e) {
      setError(e.message === 'unsupported' ? 'this browser has no passkey support' : e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="demo">
      <nav className="nav">
        <a className="brand" href="/">
          <img src="/logo.png" alt="yuin" />
        </a>
        <div className="navlinks">
          <span>Developers</span>
          <span>Use cases</span>
          <span>Docs</span>
        </div>
      </nav>

      <div className="wrap">
        {!ready ? (
          <div className="panel">
            <h3>Not configured</h3>
            <p className="muted">
              Set <code>NEXT_PUBLIC_EMAIL_IDENTITY_REGISTRY</code> and two sender URLs in{' '}
              <code>NEXT_PUBLIC_SENDERS</code>. Two, exactly — one is not this system.
            </p>
          </div>
        ) : step === 'start' ? (
          <form className="panel" onSubmit={begin}>
            <h3>Make an account</h3>
            <p className="muted">
              An email address and a password. No wallet, no seed phrase, and no record
              anywhere of which address belongs to you.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="A password only you know"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="hint">
              This password is not a login — it is half of the key. Nobody can reset it,
              including us, because nobody has it.
            </p>
            <button className="btn" type="submit" disabled={Boolean(busy)}>
              {busy || 'Continue →'}
            </button>
          </form>
        ) : step === 'codes' ? (
          <form className="panel" onSubmit={finish}>
            <h3>Two codes are on their way</h3>
            <p className="muted">
              One from each sender, both to {email}. Neither works on its own, which is
              the point — no single operator can make an account for you.
            </p>
            <input
              inputMode="numeric"
              placeholder="Code from the first sender"
              value={codes[0]}
              onChange={(e) => setCodes([e.target.value, codes[1]])}
              required
            />
            <input
              inputMode="numeric"
              placeholder="Code from the second sender"
              value={codes[1]}
              onChange={(e) => setCodes([codes[0], e.target.value])}
              required
            />
            {identity?.predicted ? (
              <p className="hint">
                Your account will be at <code>{identity.predicted}</code> — it already has
                an address, before it exists.
              </p>
            ) : null}
            <button className="btn" type="submit" disabled={Boolean(busy)}>
              {busy || 'Create my account →'}
            </button>
          </form>
        ) : step === 'passkey' ? (
          <div className="panel">
            <div className="badge">Account created</div>
            <h3>
              <code>{account}</code>
            </h3>
            <p className="muted">
              One more thing, and it matters: right now this account rests on a single key
              in this browser. Add a passkey and it survives losing this device.
            </p>
            {tx ? (
              <p className="hint">
                Transaction <code>{tx}</code>
              </p>
            ) : null}
            <button className="btn" onClick={addPasskey} disabled={Boolean(busy)}>
              {busy || 'Add a passkey →'}
            </button>
          </div>
        ) : step === 'exists' ? (
          <div className="panel">
            <h3>You already have one</h3>
            <p className="muted">
              That email and password already resolve to an account:
            </p>
            <p>
              <code>{account}</code>
            </p>
            <p className="hint">
              Which is the proof that nothing was stored: the same two things produce the
              same account, on any device, forever.
            </p>
          </div>
        ) : (
          <div className="panel">
            <div className="badge">Ready</div>
            <h3>
              <code>{account}</code>
            </h3>
            <p className="muted">
              An account with two ways in and no seed phrase. Nobody — including us — can
              lock you out of it or tell anyone it is yours.
            </p>
            <a className="btn" href="/account" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Open your account →
            </a>
          </div>
        )}

        {error ? <p className="errline">{error}</p> : null}
      </div>
    </main>
  )
}
