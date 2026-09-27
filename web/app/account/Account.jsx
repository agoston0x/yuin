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
import { bestQuote, bestQuoteExactOut, erc20Abi, parseAmount, payWithCalls, swapCalls, withHeadroom, withSlippage } from '../../lib/uniswap'
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
  const [payWith, setPayWith] = useState('USDC')
  const [payQuote, setPayQuote] = useState(null)
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

  /**
   * What it costs to send someone one token while holding another.
   *
   * Quoted before anything is signed, so the page can say "this will use 0.0081 ETH" and
   * refuse when the balance will not cover it — rather than letting a transaction fail
   * on chain and leaving somebody guessing why.
   */
  useEffect(() => {
    let cancelled = false
    async function run() {
      setPayQuote(null)
      if (!sendAmount || Number(sendAmount) <= 0 || payWith === sendToken) return
      try {
        const out = tokenBySymbol(sendToken)
        const held = tokenBySymbol(payWith)
        const amountOut = parseUnits(String(sendAmount), out.decimals)
        const best = await bestQuoteExactOut(publicClient, {
          tokenIn: held.native ? WETH : held.address,
          tokenOut: out.native ? WETH : out.address,
          amountOut,
        })
        if (!cancelled) setPayQuote({ ...best, amountOut, max: withHeadroom(best.amountIn, 1) })
      } catch {
        if (!cancelled) setPayQuote(null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [sendAmount, sendToken, payWith])

  /**
   * What it costs to send someone one token while holding another.
   *
   * Quoted before anything is signed, so the page can say "this will use about 0.0081 ETH"
   * and refuse when the balance will not cover it — rather than letting a transaction fail
   * on chain and leaving somebody to guess why.
   */
  useEffect(() => {
    let cancelled = false
    async function run() {
      setPayQuote(null)
      if (!sendAmount || Number(sendAmount) <= 0 || payWith === sendToken) return
      try {
        const out = tokenBySymbol(sendToken)
        const held = tokenBySymbol(payWith)
        const amountOut = parseUnits(String(sendAmount), out.decimals)
        const best = await bestQuoteExactOut(publicClient, {
          tokenIn: held.native ? WETH : held.address,
          tokenOut: out.native ? WETH : out.address,
          amountOut,
        })
        if (!cancelled) setPayQuote({ ...best, amountOut, max: withHeadroom(best.amountIn, 1) })
      } catch {
        if (!cancelled) setPayQuote(null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [sendAmount, sendToken, payWith])

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

      // Paying in something other than what is owed: buy exactly the amount, hand it
      // over, take the change back — one batch, so it cannot half-happen.
      if (payWith !== sendToken) {
        if (!payQuote) throw new Error('no quote for that pair yet')
        const held = tokenBySymbol(payWith)
        if (held.raw !== undefined && false) throw new Error('unreachable')

        const holding = rows.find((r) => r.symbol === payWith)
        if (holding && holding.raw < payQuote.max) {
          throw new Error(`not enough ${payWith} — that needs about ${formatUnits(payQuote.max, held.decimals)}`)
        }

        setBusy(`Swapping ${payWith} and sending…`)
        const calls = payWithCalls({
          account: session.account,
          recipient: sendTo,
          payToken: token.native ? WETH : token.address,
          holdToken: held.native ? WETH : held.address,
          amountOut: value,
          maxIn: payQuote.max,
          fee: payQuote.fee,
          fromNative: held.native,
        })
        const batched = await executeBatch(session.privateKey, session.account, calls)
        await refresh(session.account, session.address)
        setNote(`Sent. ${batched.slice(0, 12)}…`)
        return
      }

      // Paying in something other than what is owed: buy exactly the amount, hand it over,
      // take the change back — one batch, so it cannot half-happen.
      if (payWith !== sendToken) {
        if (!payQuote) throw new Error('no quote for that pair yet')
        const held = tokenBySymbol(payWith)
        const holding = rows.find((r) => r.symbol === payWith)

        if (holding && holding.raw < payQuote.max) {
          throw new Error(
            `not enough ${payWith} — that needs about ${formatUnits(payQuote.max, held.decimals)}`,
          )
        }

        setBusy(`Swapping ${payWith} and sending…`)
        const batched = await executeBatch(
          session.privateKey,
          session.account,
          payWithCalls({
            account: session.account,
            recipient: sendTo,
            payToken: token.native ? WETH : token.address,
            holdToken: held.native ? WETH : held.address,
            amountOut: value,
            maxIn: payQuote.max,
            fee: payQuote.fee,
            fromNative: held.native,
          }),
        )
        await refresh(session.account, session.address)
        setNote(`Sent. ${batched.slice(0, 12)}…`)
        return
      }

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
        <div className="wrap acct">
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

      <div className="wrap acct">
        <div className="panel">
          <h3>Your account</h3>
          <p className="muted">
            Send anything here. It is yours, and nobody — including us — can move what is
            in it.
          </p>
          <div className="addr">
            <code>{session.account}</code>
            <button onClick={() => navigator.clipboard.writeText(session.account)}>Copy</button>
          </div>

          <ul className="bal">
            {rows.map((row) => (
              <li key={row.symbol}>
                <span className="sym">{row.symbol}</span>
                <span className={Number(row.formatted) === 0 ? 'amt zero' : 'amt'}>
                  {Number(row.formatted).toFixed(row.decimals === 6 ? 2 : 5)}
                </span>
              </li>
            ))}
          </ul>

          {gas === 0n ? (
            <>
              <div className="gasnote">
                <span>
                  Your key has no gas, so it cannot move anything yet. Yuin covers it for the
                  demo — a paymaster does this properly later.
                </span>
              </div>
              <button className="btn" style={{ marginTop: 14 }} onClick={fund} disabled={Boolean(busy)}>
                {busy || 'Get some gas →'}
              </button>
            </>
          ) : (
            <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
              Key gas {Number(formatUnits(gas, 18)).toFixed(5)} ETH
            </p>
          )}
        </div>

        <div className="panel">
          <h3>Swap</h3>
          <p className="muted">Straight through Uniswap, from the account itself.</p>

          <div className="swapbox">
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {TOKENS.map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
            <span className="to">→</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {TOKENS.map((t) => (
                <option key={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>

          <input
            className="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.001"
            style={{ width: '100%', padding: '13px 12px', border: '1.5px solid #cfc6b2', borderRadius: 12, background: '#f5f0e4', font: 'inherit', marginBottom: 12 }}
          />

          <div className="rate">
            {quote ? (
              <>
                <b>
                  {Number(formatUnits(quote.amountOut, outToken.decimals)).toFixed(4)} {to}
                </b>
                <span className="dim">best of three pools · {quote.fee / 10000}% fee tier</span>
              </>
            ) : (
              <span className="dim">Enter an amount for a quote.</span>
            )}
          </div>

          <button className="btn" onClick={swap} disabled={!quote || Boolean(busy) || gas === 0n}>
            {busy || `Swap ${from} for ${to} →`}
          </button>
        </div>

        <div className="panel">
          <h3>Send</h3>
          <p className="muted">Out of the account, to anyone.</p>
          <div className="sendrow">
            <div className="pair">
              <select value={sendToken} onChange={(e) => setSendToken(e.target.value)}>
                {TOKENS.map((t) => (
                  <option key={t.symbol}>{t.symbol}</option>
                ))}
              </select>
              <input placeholder="amount" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
            </div>
            <input placeholder="0x…" value={sendTo} spellCheck={false} onChange={(e) => setSendTo(e.target.value)} />
            <div className="pair">
              <span className="hint" style={{ alignSelf: 'center', margin: 0 }}>paying with</span>
              <select value={payWith} onChange={(e) => setPayWith(e.target.value)}>
                {TOKENS.map((t) => (
                  <option key={t.symbol}>{t.symbol}</option>
                ))}
              </select>
            </div>
          </div>

          {payWith !== sendToken ? (
            <div className="rate">
              {payQuote ? (
                <>
                  <b>
                    about {Number(formatUnits(payQuote.max, tokenBySymbol(payWith).decimals)).toFixed(6)}{' '}
                    {payWith}
                  </b>
                  <span className="dim">
                    they receive exactly {sendAmount} {sendToken} · swapped inside the same
                    transaction · change comes back
                  </span>
                </>
              ) : (
                <span className="dim">Enter an amount for a quote.</span>
              )}
            </div>
          ) : null}
          <button
            className="btn"
            onClick={send}
            disabled={Boolean(busy) || gas === 0n || (payWith !== sendToken && !payQuote)}
          >
            {busy || 'Send →'}
          </button>
        </div>

        {note ? <p className="hint">{note}</p> : null}
        {error ? <p className="errline">{error}</p> : null}
      </div>
    </main>
  )
}
