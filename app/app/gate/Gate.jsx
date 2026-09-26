'use client'

/**
 * Two gates, one page.
 *
 * IDKit opens World App (or its QR, on desktop), the phone produces a proof, and the
 * proof goes straight to our own server to be verified. Nothing is decided here: this
 * component knows only what the server told it.
 *
 * The two checks are deliberately separate. Personhood says someone live is here; age
 * says they are an adult. An app that needs one rarely needs the other, and conflating
 * them is how people end up handing over a passport to read a blog.
 */
import { useState } from 'react'
import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit'

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID
const ACTION_HUMAN = process.env.NEXT_PUBLIC_WORLD_ACTION_HUMAN || 'enter'
const ACTION_AGE = process.env.NEXT_PUBLIC_WORLD_ACTION_AGE || 'age'

const GATES = [
  {
    id: 'human',
    action: ACTION_HUMAN,
    level: VerificationLevel.Orb,
    title: 'A live person',
    note: 'Stops a script. Says nothing about who you are.',
  },
  {
    id: 'age',
    action: ACTION_AGE,
    level: VerificationLevel.Document,
    title: 'An adult',
    note: 'A document check. We learn the answer, never the document.',
  },
]

export default function Gate() {
  const [passed, setPassed] = useState({})
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const configured = Boolean(APP_ID && APP_ID.startsWith('app_'))

  /**
   * IDKit calls this with the proof. Throwing here is what makes the widget show a
   * failure — returning quietly would let a rejected proof look like a pass.
   */
  async function handleProof(gate, result) {
    setError('')
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...result, action: gate.action }),
    })
    const data = await response.json()

    if (!data.ok) {
      setError(data.error ?? 'the proof did not verify')
      throw new Error(data.error ?? 'verification failed')
    }

    setPassed((current) => ({ ...current, [gate.id]: true }))
    setDetail(data)
  }

  if (!configured) {
    return (
      <div className="card">
        <h3>Not configured yet</h3>
        <p className="muted">
          Set <code>NEXT_PUBLIC_WORLD_APP_ID</code> from the World developer portal, plus an
          action id for each gate. Until then there is nothing honest to show.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <div className="gate">
          {GATES.map((gate) => (
            <div className="row" key={gate.id}>
              <div>
                <b>{gate.title}</b>
                <span>{gate.note}</span>
              </div>
              {passed[gate.id] ? (
                <div className="state open">Passed</div>
              ) : (
                <IDKitWidget
                  app_id={APP_ID}
                  action={gate.action}
                  verification_level={gate.level}
                  handleVerify={(result) => handleProof(gate, result)}
                  onSuccess={() => {}}
                >
                  {({ open }) => (
                    <button className="ghost" onClick={open}>
                      Verify with World
                    </button>
                  )}
                </IDKitWidget>
              )}
            </div>
          ))}
        </div>

        {error ? <p className="err">{error}</p> : null}
      </div>

      <div className="card">
        <h3>The room behind the gate</h3>
        <p className="muted">What an app would show only to someone who got through.</p>
        {passed.human ? (
          <div className="state open">Open — a live person is here</div>
        ) : (
          <div className="state shut">Shut — nobody has proved they are a person</div>
        )}
        <div style={{ marginTop: 12 }}>
          {passed.age ? (
            <div className="state open">Open — and old enough</div>
          ) : (
            <div className="state wait">Age not established</div>
          )}
        </div>

        {detail ? (
          <div className="out">
            {JSON.stringify(detail, null, 2)}
          </div>
        ) : null}
      </div>
    </>
  )
}
