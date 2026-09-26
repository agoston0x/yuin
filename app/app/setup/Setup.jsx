'use client'

/**
 * Registering an app, and setting what it asks of people.
 *
 * Three things happen here and they are deliberately separate transactions: claiming the
 * name, saying which methods are accepted, and — later — naming an action that needs
 * more. A developer who only wants the first can stop after it.
 *
 * Everything is written from the developer's own wallet. We could not edit their record
 * if we wanted to, which is the only reason a public registry of what apps demand is
 * worth anything.
 */
import { useState } from 'react'
import { formatEther, zeroHash } from 'viem'
import { appRegistryAbi, resolverAbi } from '../lib/abi'
import { METHODS, LOGIN_ACTION, appIdFor, idFor, kindHash } from '../lib/methods'
import { config, connect, publicClient, waitFor } from '../lib/chain'

export default function Setup() {
  const [wallet, setWallet] = useState(null)
  const [label, setLabel] = useState('')
  const [app, setApp] = useState(null)
  const [aud, setAud] = useState('')
  const [chosen, setChosen] = useState(() => new Set(['email', 'passkey']))
  const [records, setRecords] = useState(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const ready = Boolean(config.appRegistry)
  const name = label ? `${label.trim().toLowerCase()}.app.${config.ensRoot}` : `<name>.app.${config.ensRoot}`

  function fail(e) {
    setError(e.shortMessage ?? e.message)
    setBusy('')
  }

  async function onConnect() {
    try {
      setError('')
      setWallet(await connect())
    } catch (e) {
      fail(e)
    }
  }

  /** Is this name taken, and if it is ours, what does it currently say? */
  async function load() {
    setError('')
    setNote('')
    setRecords(null)
    try {
      const appId = appIdFor(label)
      const registered = await publicClient.readContract({
        address: config.appRegistry,
        abi: appRegistryAbi,
        functionName: 'isRegistered',
        args: [appId],
      })

      if (!registered) {
        setApp(null)
        setNote('Free. Claim it below.')
        return
      }

      const record = await publicClient.readContract({
        address: config.appRegistry,
        abi: appRegistryAbi,
        functionName: 'appOf',
        args: [appId],
      })
      setApp(record)
      setAud(record.aud)

      const login = await publicClient.readContract({
        address: config.appRegistry,
        abi: appRegistryAbi,
        functionName: 'policyFor',
        args: [appId, LOGIN_ACTION],
      })
      setChosen(new Set(login.map(idFor)))

      const mine = wallet && record.owner.toLowerCase() === wallet.account.toLowerCase()
      setNote(mine ? 'Yours. Change what it asks for below.' : `Taken, by ${record.owner}.`)
    } catch (e) {
      fail(e)
    }
  }

  async function claim() {
    try {
      setError('')
      setBusy('Confirm in your wallet…')
      const stake = await publicClient.readContract({
        address: config.appRegistry,
        abi: appRegistryAbi,
        functionName: 'MIN_STAKE',
      })

      const hash = await wallet.client.writeContract({
        address: config.appRegistry,
        abi: appRegistryAbi,
        functionName: 'register',
        args: [appIdFor(label), aud.trim(), '', zeroHash],
        value: stake,
      })

      setBusy('Claiming…')
      await waitFor(hash)
      await load()
      setBusy('')
    } catch (e) {
      fail(e)
    }
  }

  /**
   * The methods a user must present to get in at all. Saving this is the moment the
   * app's rules become public — and binding, since the SDK reads them at every login.
   */
  async function savePolicy() {
    try {
      setError('')
      setBusy('Confirm in your wallet…')
      const kinds = METHODS.filter((m) => chosen.has(m.id) && !m.soon).map((m) => kindHash(m.id))

      const hash = await wallet.client.writeContract({
        address: config.appRegistry,
        abi: appRegistryAbi,
        functionName: 'setPolicy',
        args: [appIdFor(label), LOGIN_ACTION, kinds],
      })

      setBusy('Saving…')
      await waitFor(hash)
      setBusy('')
      setNote('Saved. Everyone signing in from now on is held to this.')
    } catch (e) {
      fail(e)
    }
  }

  /** What the world sees — read back from the resolver, not from our own state. */
  async function showRecords() {
    try {
      setError('')
      const keys = ['yuin.aud', 'yuin.login']
      const values = await Promise.all(
        keys.map((key) =>
          publicClient.readContract({
            address: config.appResolver,
            abi: resolverAbi,
            functionName: 'textFor',
            args: [label.trim().toLowerCase(), key],
          }),
        ),
      )
      setRecords(keys.map((key, i) => [key, values[i]]))
    } catch (e) {
      fail(e)
    }
  }

  function toggle(id) {
    const next = new Set(chosen)
    next.has(id) ? next.delete(id) : next.add(id)
    setChosen(next)
  }

  const mine = app && wallet && app.owner.toLowerCase() === wallet.account.toLowerCase()

  if (!ready) {
    return (
      <div className="card">
        <h3>Not configured</h3>
        <p className="muted">
          Set <code>NEXT_PUBLIC_APP_REGISTRY</code> and <code>NEXT_PUBLIC_APP_RESOLVER</code>.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h3>Your wallet</h3>
        <p className="muted">
          The record belongs to you. We hold no key that could edit it, which is the point.
        </p>
        {wallet ? (
          <div className="state open">{wallet.account}</div>
        ) : (
          <button className="btn" onClick={onConnect}>
            Connect a wallet →
          </button>
        )}
      </div>

      <div className="card">
        <h3>Name your app</h3>
        <p className="muted">
          It becomes <code>{name}</code>, and anyone can read its rules from there.
        </p>
        <div className="stack">
          <input
            placeholder="game"
            value={label}
            spellCheck={false}
            onChange={(e) => setLabel(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button className="ghost" onClick={load} disabled={!label}>
            Check
          </button>
        </div>
        {note ? <p className="muted" style={{ marginTop: 14 }}>{note}</p> : null}
      </div>

      {wallet && label && !app ? (
        <div className="card">
          <h3>Claim it</h3>
          <p className="muted">
            The stake is what makes the record credible. Withdraw it and the app retires —
            there is no half-staked state where it still looks live.
          </p>
          <input
            placeholder="Google client ID, if you want the Google path"
            value={aud}
            spellCheck={false}
            onChange={(e) => setAud(e.target.value)}
          />
          <div className="stack">
            <button className="btn" onClick={claim} disabled={Boolean(busy)}>
              {busy || 'Stake and claim →'}
            </button>
          </div>
        </div>
      ) : null}

      {mine ? (
        <>
          <div className="card">
            <h3>To sign in, people need</h3>
            <p className="muted">
              Pick the least you can get away with. Every extra thing here is something a
              stranger has to do before they can use your app.
            </p>
            <div className="gate">
              {METHODS.map((m) => (
                <label className="row" key={m.id} style={{ cursor: m.soon ? 'default' : 'pointer' }}>
                  <div>
                    <b>
                      {m.label}
                      {m.soon ? ' — coming soon' : ''}
                    </b>
                    <span>{m.note}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chosen.has(m.id)}
                    disabled={m.soon}
                    onChange={() => toggle(m.id)}
                    style={{ width: 20, height: 20 }}
                  />
                </label>
              ))}
            </div>
            <div className="stack">
              <button className="btn" onClick={savePolicy} disabled={Boolean(busy)}>
                {busy || 'Save →'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3>What the world sees</h3>
            <p className="muted">
              Read straight from <code>{name}</code>. Your users can check this before they
              trust you with anything.
            </p>
            <button className="ghost" onClick={showRecords}>
              Read the records
            </button>
            {records ? (
              <div className="out">
                {records.map(([k, v]) => `${k} = ${v || '—'}`).join('\n')}
              </div>
            ) : null}
            <p className="muted" style={{ marginTop: 14 }}>
              Staked {app ? formatEther(app.stake) : '0'} ETH.
            </p>
          </div>
        </>
      ) : null}

      {error ? <p className="err">{error}</p> : null}
    </>
  )
}
