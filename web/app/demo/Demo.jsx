'use client'

/**
 * A page that decides who gets in, live.
 *
 * Two switches stand in for what a developer would tick in the console. Age on means
 * nobody sees the page without proving they are old enough; live-person on means the
 * button does nothing until someone proves they are one. Neither can be talked past from
 * the browser: World App produces the proof, and our own server asks World whether it is
 * good.
 *
 * What the page learns is remarkably little. Not a birthday — only that a threshold was
 * met. Not a face — only that one was there. That is the whole argument: ask the question
 * you actually have, and nothing beyond it.
 */
import { useEffect, useState } from 'react'
import { IDKitRequestWidget } from '@worldcoin/idkit'
import { identityCheck, selfieCheck } from '@worldcoin/idkit-core'

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID
const ACTION_AGE = process.env.NEXT_PUBLIC_WORLD_ACTION_AGE || 'age'
const ACTION_SELFIE = process.env.NEXT_PUBLIC_WORLD_ACTION_SELFIE || 'selfie'
const MINIMUM_AGE = Number(process.env.NEXT_PUBLIC_MINIMUM_AGE || 18)

/**
 * World's errors arrive in several shapes depending on where they were raised. Keeping
 * the code verbatim matters more than a tidy sentence: "credential_unavailable" tells you
 * what to do next, "Something went wrong" does not.
 */
function describe(e) {
  if (!e) return 'World App did not complete the check'
  if (typeof e === 'string') return e
  return e.code ?? e.detail ?? e.message ?? JSON.stringify(e)
}

export default function Demo() {
  const [gates, setGates] = useState({ age: false, selfie: false })
  const [passed, setPassed] = useState({ age: false, selfie: false })
  const [context, setContext] = useState({ age: null, selfie: null })
  const [open, setOpen] = useState(null) // which gate's widget is showing
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')

  const configured = Boolean(APP_ID && APP_ID.startsWith('app_'))

  // A gate switched off takes its proof with it, so switching it back on asks again
  // rather than letting the previous visitor coast through on an old pass.
  useEffect(() => {
    setPassed((p) => ({ age: gates.age ? p.age : false, selfie: gates.selfie ? p.selfie : false }))
  }, [gates.age, gates.selfie])

  /**
   * Every request has to be signed by us before World App will entertain it, and the key
   * that does the signing is on the server. So the first step of opening a gate is asking
   * our own backend for permission to ask.
   */
  async function openGate(which, action) {
    setError('')
    try {
      const response = await fetch('/api/rp-context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const rp = await response.json()
      if (!response.ok) throw new Error(rp.error ?? 'could not sign the request')

      setContext((c) => ({ ...c, [which]: rp }))
      setOpen(which)
    } catch (e) {
      setError(e.message)
    }
  }

  async function check(result) {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
    })
    const data = await response.json()
    if (!data.ok) {
      setError(data.error ?? 'World did not accept that proof')
      throw new Error(data.error ?? 'verification failed')
    }
  }

  const locked = gates.age && !passed.age

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
        <div className="panel">
          <h3>What this page requires</h3>
          <p className="muted">
            Standing in for the console. Tick a box and the rules change for the visitor
            below — no reload, no redeploy.
          </p>
          <div className="switches">
            <label className="switch">
              <input
                type="checkbox"
                checked={gates.age}
                onChange={(e) => setGates((g) => ({ ...g, age: e.target.checked }))}
              />
              <span>
                <b>Old enough</b>
                <span>
                  Checked at the door, from a passport. We learn that you are over{' '}
                  {MINIMUM_AGE} and nothing else — not your birthday, not your name.
                </span>
              </span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={gates.selfie}
                onChange={(e) => setGates((g) => ({ ...g, selfie: e.target.checked }))}
              />
              <span>
                <b>A live person</b>
                <span>Checked at the button, which is the moment that actually matters.</span>
              </span>
            </label>
          </div>
        </div>

        {!configured ? (
          <div className="panel">
            <h3>Not configured</h3>
            <p className="muted">
              Set <code>NEXT_PUBLIC_WORLD_APP_ID</code>, <code>WORLD_RP_ID</code> and{' '}
              <code>WORLD_RP_SIGNING_KEY</code>, then rebuild. There is nothing honest to
              show until then.
            </p>
          </div>
        ) : locked ? (
          <div className="panel locked">
            <h2>Members only.</h2>
            <p>
              This page is age-restricted. Scan with World App and prove you are over{' '}
              {MINIMUM_AGE} — the proof says only that, and your passport never leaves your
              phone.
            </p>
            <button className="btn" onClick={() => openGate('age', ACTION_AGE)}>
              Verify age with World →
            </button>
            {error ? <p className="errline">{error}</p> : null}
          </div>
        ) : (
          <div className="panel content">
            {gates.age ? <div className="badge">Over {MINIMUM_AGE}, verified</div> : null}
            <h2>Kuramoto Auction.</h2>
            <p>
              Three bottles of Juyondai, sold at seven. You are looking at the part of the
              page that only exists for people who got past the door.
            </p>
            <div className="stack" style={{ marginTop: 26 }}>
              <button
                className="btn"
                onClick={() =>
                  gates.selfie && !passed.selfie ? openGate('selfie', ACTION_SELFIE) : setModal(true)
                }
              >
                Place a bid →
              </button>
            </div>
            {error ? <p className="errline">{error}</p> : null}
          </div>
        )}
      </div>

      {/* One widget per gate, each with its own signed request and its own preset. */}
      {configured && context.age ? (
        <IDKitRequestWidget
          open={open === 'age'}
          onOpenChange={(next) => setOpen(next ? 'age' : null)}
          app_id={APP_ID}
          action={ACTION_AGE}
          rp_context={context.age}
          preset={identityCheck({ attributes: [{ type: 'minimum_age', value: MINIMUM_AGE }] })}
          handleVerify={check}
          onSuccess={() => setPassed((p) => ({ ...p, age: true }))}
          onError={(e) => setError(describe(e))}
          allow_legacy_proofs={false}
        />
      ) : null}

      {configured && context.selfie ? (
        <IDKitRequestWidget
          open={open === 'selfie'}
          onOpenChange={(next) => setOpen(next ? 'selfie' : null)}
          app_id={APP_ID}
          action={ACTION_SELFIE}
          rp_context={context.selfie}
          preset={selfieCheck()}
          handleVerify={check}
          onSuccess={() => {
            setPassed((p) => ({ ...p, selfie: true }))
            setModal(true)
          }}
          onError={(e) => setError(describe(e))}
          allow_legacy_proofs={false}
        />
      ) : null}

      {modal ? (
        <div className="modal" onClick={() => setModal(false)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <h3>{gates.selfie ? 'Selfie verified' : 'Bid placed'}</h3>
            <p>
              {gates.selfie
                ? 'A live person is on the other end of this bid. World said so; this page only asked.'
                : 'No gate was in the way, so the bid went straight through.'}
            </p>
            <button className="btn" onClick={() => setModal(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
