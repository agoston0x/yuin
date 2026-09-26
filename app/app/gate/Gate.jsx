'use client'

/**
 * Two gates, one page, and the difference between them is the point.
 *
 * Personhood says a live human is here right now. Age says an adult is. Passing one does
 * not pass the other, because they answer different questions — and an app that needs one
 * of them rarely needs both.
 *
 * Nothing here decides anything. World App produces the proof, our own server asks World
 * whether it is good, and this component only ever learns the answer. A proof checked in
 * the browser would be worthless: the page doing the checking is the page that could lie.
 */
import { useState } from 'react'
import { IDKitRequestWidget } from '@worldcoin/idkit'
import { identityCheck, selfieCheck } from '@worldcoin/idkit-core'

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID
const ACTION_HUMAN = process.env.NEXT_PUBLIC_WORLD_ACTION_HUMAN || 'enter'
const ACTION_AGE = process.env.NEXT_PUBLIC_WORLD_ACTION_AGE || 'age'
const MINIMUM_AGE = Number(process.env.NEXT_PUBLIC_MINIMUM_AGE || 18)
const ENVIRONMENT = process.env.NEXT_PUBLIC_WORLD_ENV || 'production'

const GATES = [
  {
    id: 'human',
    action: ACTION_HUMAN,
    title: 'A live person',
    note: 'Stops a script. Says nothing about who you are.',
    preset: () => selfieCheck(),
  },
  {
    id: 'age',
    action: ACTION_AGE,
    title: `Over ${MINIMUM_AGE}`,
    note: 'From a passport. We learn the answer, never the document.',
    preset: () => identityCheck({ attributes: [{ type: 'minimum_age', value: MINIMUM_AGE }] }),
  },
]

/**
 * World's errors arrive in several shapes depending on where they were raised. Keeping
 * the code verbatim matters more than a tidy sentence: "environment_not_allowed" tells
 * you what to do next, "something went wrong" does not.
 */
function describe(e) {
  if (!e) return 'World App did not complete the check'
  if (typeof e === 'string') return e
  return e.code ?? e.detail ?? e.message ?? JSON.stringify(e)
}

export default function Gate() {
  const [passed, setPassed] = useState({})
  const [context, setContext] = useState({})
  const [open, setOpen] = useState(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const configured = Boolean(APP_ID && APP_ID.startsWith('app_'))

  /**
   * Every request has to be signed by us before World App will entertain it, and the key
   * that signs it is on the server. So opening a gate starts by asking our own backend
   * for permission to ask.
   */
  async function openGate(gate) {
    setError('')
    try {
      const response = await fetch('/api/rp-context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: gate.action }),
      })
      const rp = await response.json()
      if (!response.ok) throw new Error(rp.error ?? 'could not sign the request')

      setContext((c) => ({ ...c, [gate.id]: rp }))
      setOpen(gate.id)
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
    setDetail(data.result ?? data)
  }

  if (!configured) {
    return (
      <div className="card">
        <h3>Not configured yet</h3>
        <p className="muted">
          Set <code>NEXT_PUBLIC_WORLD_APP_ID</code>, <code>WORLD_RP_ID</code> and{' '}
          <code>WORLD_RP_SIGNING_KEY</code> from the developer portal. Until then there is
          nothing honest to show.
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
                <button className="ghost" onClick={() => openGate(gate)}>
                  Verify with World
                </button>
              )}
            </div>
          ))}
        </div>

        {error ? <p className="err">{error}</p> : null}
      </div>

      {GATES.map((gate) =>
        context[gate.id] ? (
          <IDKitRequestWidget
            key={gate.id}
            open={open === gate.id}
            onOpenChange={(next) => setOpen(next ? gate.id : null)}
            app_id={APP_ID}
            action={gate.action}
            rp_context={context[gate.id]}
            environment={ENVIRONMENT}
            allow_legacy_proofs={false}
            preset={gate.preset()}
            handleVerify={check}
            onSuccess={() => setPassed((p) => ({ ...p, [gate.id]: true }))}
            onError={(e) => setError(describe(e))}
          />
        ) : null,
      )}

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
            <div className="state open">Open — and over {MINIMUM_AGE}</div>
          ) : (
            <div className="state wait">Age not established</div>
          )}
        </div>

        {detail ? <div className="out">{JSON.stringify(detail, null, 2)}</div> : null}
      </div>
    </>
  )
}
