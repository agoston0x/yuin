'use client'

/**
 * Balances, funding, swapping, sending.
 *
 * Everything here goes through the account's own `execute`, signed by the owner key in
 * this browser. Nobody else can move anything, and nothing needs a bundler — which makes
 * this both simpler to run and easier to believe.
 *
 * The rate comes from asking all three Uniswap pools and taking the best, because on
 * Sepolia their depth differs by an order of magnitude and the wrong one is visibly bad.
 */
import { useEffect, useState } from 'react'
import { formatUnits, isAddress, parseUnits } from 'viem'
import * as owner from '../../lib/owner'
import { balances, execute, executeBatch, ownerGas, publicClient } from '../../lib/account'
import { bestQuote, erc20Abi, parseAmount, swapCalls, withSlippage } from '../../lib/uniswap'
import { TOKENS, USDC, WETH, tokenBySymbol } from '../../lib/tokens'
import { encodeFunctionData } from 'viem'

const SENDERS = (process.env.NEXT_PUBLIC_SENDERS || '').split(',').map((s) => s.trim()).filter(Boolean)

export default function Account() {
  const [session, setSession] = useState(null)
  const [rows, setRows] = useState([])
  const [gas, setGas] = useState(0n)
  const [from, setFrom] = useState('ETH')
  const [to, setTo] = useState('USDC')
  const [amount, setAmount] = useState('0.001')
  const [quote, setQuote] = useState(null)
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendToken, setSendToken] = useState('USDC')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = owner.current()
    if (stored?.account) setSession(stored)
  }, [])

  async function refresh(account, ownerAddress) {
    setRows(await balances(account))
    setGas(await ownerGas(ownerAddress))
  }

  useEffect(() => {
    if (session) refresh(session.account, session.address).catch((e) => setError(e.message))
  }, [session])

  /** Ask the pools what this would actually get, before anyone commits to it. */
  useEffect(() => {
    let cancelled = false
    async function run() {
      setQuote(null)
      if (!amount || Number(amount) <= 0 || from === to) return
      try {
        const tokenIn = from === 'ETH' ? WETH : tokenBySymbol(from).address
        const tokenOut = to === 'ETH' ? WETH : tokenBySymbol(to).address
        const amountIn = parseAmount(amount, tokenBySymbol(from).decimals)
        const best = await bestQuote(publicClient, { tokenIn, tokenOut, amountIn })
        if (!cancelled) setQuote({ ...best, amountIn })
      } catch {
        if (!cancelled) setQuote(null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [from, to, amount])

  async function fund() {
    try {
      setError('')
      setBusy('Asking for gas…')
      await fetch(new URL('/drip', SENDERS[0]), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: session.address }),
      })
      await refresh(session.account, session.address)
      setNote('Funded. This is Yuin paying — a paymaster does this properly later.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  async function swap() {
    try {
      setError('')
      if (!quote) throw new Error('no quote yet')

      const tokenIn = from === 'ETH' ? WETH : tokenBySymbol(from).address
      const tokenOut = to === 'ETH' ? WETH : tokenBySymbol(to).address
      const calls = swapCalls({
        account: session.account,
        tokenIn,
        tokenOut,
        amountIn: quote.amountIn,
        amountOutMinimum: withSlippage(quote.amountOut, 1),
        fee: quote.fee,
        fromNative: from === 'ETH',
      })

      setBusy(calls.length > 1 ? 'Approving and swapping…' : 'Swapping…')
      const hash =
        calls.length > 1
          ? await executeBatch(session.privateKey, session.account, calls)
          : await execute(session.privateKey, session.account, calls[0])

      await refresh(session.account, session.address)
      setNote(`Swapped. ${hash.slice(0, 12)}…`)
    } catch (e) {
      setError(e.shortMessage ?? e.message)
    } finally {
      setBusy('')
    }
  }

  async function send() {
    try {
      setError('')
      if (!isAddress(sendTo)) throw new Error('that is not an address')
      const token = tokenBySymbol(sendToken)
      const value = parseUnits(String(sendAmount), token.decimals)

      setBusy('Sending…')
      const call = token.native
        ? { to: sendTo, value, data: '0x' }
        : {
            to: token.address,
            value: 0n,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [sendTo, value] }),
          }

      const hash = await execute(session.privateKey, session.account, call)
      await refresh(session.account, session.address)
      setNote(`Sent. ${hash.slice(0, 12)}…`)
    } catch (e) {
      setError(e.shortMessage ?? e.message)
    } finally {
      setBusy('')
    }
  }

  if (!session) {
    return (
      <main className="demo">
        <div className="wrap">
          <div className="panel">
            <h3>No account here</h3>
            <p className="muted">
              This browser holds no key. <a href="/join/">Make an account</a> and it will.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const outToken = tokenBySymbol(to)

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
          <h3>Your account</h3>
          <p className="muted">
            Send anything to this address. It is yours, and nobody — including us — can
            move what is in it.
          </p>
          <div className="out">{session.account}</div>

          <div className="gate" style={{ marginTop: 20 }}>
            {rows.map((row) => (
              <div className="row" key={row.symbol}>
                <div>
                  <b>{row.symbol}</b>
                  <span>{row.native ? 'native' : row.address}</span>
                </div>
                <div>{Number(row.formatted).toFixed(row.decimals === 6 ? 2 : 5)}</div>
              </div>
            ))}
          </div>

          {gas === 0n ? (
            <>
              <p className="muted" style={{ marginTop: 18 }}>
                Your key has no gas yet, so it cannot move anything. Yuin will cover it for
                the demo — a paymaster does this properly later.
              </p>
              <button className="btn" onClick={fund} disabled={Boolean(busy)}>
                {busy || 'Get some gas →'}
              </button>
            </>
          ) : (
            <p className="hint" style={{ marginTop: 16 }}>
              Key gas: {Number(formatUnits(gas, 18)).toFixed(5)} ETH
            </p>
          )}
        </div>

        <div className="panel">
          <h3>Swap</h3>
          <p className="muted">
            Straight through Uniswap, from the account itself. Best of three pools.
          </p>
          <div className="stack">
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {TOKENS.map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {TOKENS.map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
          <p className="hint">
            {quote
              ? `→ ${Number(formatUnits(quote.amountOut, outToken.decimals)).toFixed(4)} ${to} (${quote.fee / 10000}% pool)`
              : 'no quote'}
          </p>
          <button className="btn" onClick={swap} disabled={!quote || Boolean(busy) || gas === 0n}>
            {busy || 'Swap →'}
          </button>
        </div>

        <div className="panel">
          <h3>Send</h3>
          <p className="muted">Out of the account, to anyone.</p>
          <div className="stack">
            <select value={sendToken} onChange={(e) => setSendToken(e.target.value)}>
              {TOKENS.map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
            <input
              placeholder="amount"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              style={{ width: 120 }}
            />
            <input
              placeholder="0x…"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              spellCheck={false}
              style={{ flex: 1, minWidth: 200 }}
            />
          </div>
          <button className="btn" onClick={send} disabled={Boolean(busy) || gas === 0n}>
            {busy || 'Send →'}
          </button>
        </div>

        {note ? <p className="hint">{note}</p> : null}
        {error ? <p className="errline">{error}</p> : null}
      </div>
    </main>
  )
}
