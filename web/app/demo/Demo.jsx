'use client'

/**
 * A page that decides who gets in, live.
 *
 * Two switches stand in for what a developer would set in the console. Ticking "age"
 * means nobody sees the page without a passport check; ticking "live person" means the
 * button does nothing until someone proves they are one. Neither can be talked past from
 * the browser: the proof goes to World, and the answer comes back from our own server.
 *
 * Turning a gate off clears what it had established. A visitor who was let in under the
 * old rules is not quietly still inside under the new ones.
 */
import { useEffect, useState } from 'react'
import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit'

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID
const ACTION_AGE = process.env.NEXT_PUBLIC_WORLD_ACTION_AGE || 'age'
const ACTION_SELFIE = process.env.NEXT_PUBLIC_WORLD_ACTION_SELFIE || 'selfie'

export default function Demo() {
  const [gates, setGates] = useState({ age: false, selfie: false })
  const [passed, setPassed] = useState({ age: false, selfie: false })
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')

  // A gate switched off takes its proof with it, so the next time it is switched on the
  // visitor is asked again rather than coasting on an old pass.
  useEffect(() => {
    setPassed((p) => ({ age: gates.age ? p.age : false, selfie: gates.selfie ? p.selfie : false }))
  }, [gates.age, gates.selfie])

  async function check(action, result) {
    setError('')
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...result, action }),
    })
    const data = await response.json()
    if (!data.ok) {
      setError(data.error ?? 'World did not accept that proof')
      throw new Error(data.error ?? 'verification failed')
    }
    return data
  }

  const configured = Boolean(APP_ID && APP_ID.startsWith('app_'))
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
            Stand in for the console. Tick a box and the rules change for the visitor
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
                <b>Age, by passport</b>
                <span>Checked at the door. Nobody sees the page without it.</span>
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
                <span>Checked at the button, which is the moment that matters.</span>
              </span>
            </label>
          </div>
        </div>

        {!configured ? (
          <div className="panel">
            <h3>Not configured</h3>
            <p className="muted">
              Set <code>NEXT_PUBLIC_WORLD_APP_ID</code> and rebuild. There is nothing
              honest to show until then.
            </p>
          </div>
        ) : locked ? (
          <div className="panel locked">
            <h2>Members only.</h2>
            <p>
              This page is age-restricted. Scan with World App and prove you are old
              enough — we learn the answer, never the document.
            </p>
            <IDKitWidget
              app_id={APP_ID}
              action={ACTION_AGE}
              verification_level={VerificationLevel.Document}
              handleVerify={async (result) => {
                await check(ACTION_AGE, result)
              }}
              onSuccess={() => setPassed((p) => ({ ...p, age: true }))}
            >
              {({ open }) => (
                <button className="btn" onClick={open}>
                  Verify age with World →
                </button>
              )}
            </IDKitWidget>
            {error ? <p className="errline">{error}</p> : null}
          </div>
        ) : (
          <div className="panel content">
            {gates.age ? <div className="badge">Age verified</div> : null}
            <h2>Kuramoto Auction.</h2>
            <p>
              Three bottles of Juyondai, sold at seven. Bidding opens when the room does.
              You are looking at the part of the page that only exists for people who got
              past the door.
            </p>
            <div className="stack" style={{ marginTop: 26 }}>
              {gates.selfie && !passed.selfie ? (
                <IDKitWidget
                  app_id={APP_ID}
                  action={ACTION_SELFIE}
                  verification_level={VerificationLevel.Orb}
                  handleVerify={async (result) => {
                    await check(ACTION_SELFIE, result)
                  }}
                  onSuccess={() => {
                    setPassed((p) => ({ ...p, selfie: true }))
                    setModal(true)
                  }}
                >
                  {({ open }) => (
                    <button className="btn" onClick={open}>
                      Place a bid →
                    </button>
                  )}
                </IDKitWidget>
              ) : (
                <button className="btn" onClick={() => setModal(true)}>
                  Place a bid →
                </button>
              )}
            </div>
            {error ? <p className="errline">{error}</p> : null}
          </div>
        )}
      </div>

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
