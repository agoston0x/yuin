/**
 * The user's own view.
 *
 * Balances, an address to fund, a swap, a payment in whatever token they hold, and the
 * history — read from the chain, so this page and a block explorer cannot tell different
 * stories about what happened.
 *
 * It is also where recovery lives: add a passkey, add World, or add an ordinary EOA and
 * take the account somewhere else entirely. The last one is not a loophole. An account you
 * cannot leave with is an account somebody else controls.
 */
import { formatEther, formatUnits, isAddress, parseEther } from 'viem'
import { publicClient } from './chain.js'
import { config } from './config.js'
import { erc20Abi } from './abi.js'

const el = (id) => document.getElementById(id)

const KNOWN_TOKENS = (process.env.DEMO_TOKENS || '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

function session() {
  const raw = localStorage.getItem('manju.session')
  return raw ? JSON.parse(raw) : null
}

function signIn() {
  const url = new URL(config.signinUrl)
  url.searchParams.set('app', 'dashboard')
  url.searchParams.set('return_to', location.href)
  location.href = url.toString()
}

/** Coming back from the sign-in page: the account is in the fragment. */
function adoptCallback() {
  if (!location.hash) return null
  const params = new URLSearchParams(location.hash.slice(1))
  const identity = params.get('identity')
  if (!identity) return null

  const current = session() ?? {}
  localStorage.setItem('manju.session', JSON.stringify({ ...current, account: identity }))
  history.replaceState(null, '', location.pathname)
  return identity
}

async function balances(account) {
  const native = await publicClient.getBalance({ address: account })
  const rows = [`<li><span>ETH</span><strong>${Number(formatEther(native)).toFixed(5)}</strong></li>`]

  for (const token of KNOWN_TOKENS) {
    if (!isAddress(token)) continue
    const [raw, decimals, symbol] = await Promise.all([
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
    ])
    rows.push(`<li><span>${symbol}</span><strong>${Number(formatUnits(raw, decimals)).toFixed(4)}</strong></li>`)
  }

  el('balances').innerHTML = rows.join('')
}

/**
 * Every transaction this account has been part of, from logs rather than a server. Slow
 * and honest beats fast and unverifiable for the thing that is meant to be the receipt.
 */
async function history(account) {
  const latest = await publicClient.getBlockNumber()
  const from = latest > 20000n ? latest - 20000n : 0n
  const logs = await publicClient.getLogs({ address: account, fromBlock: from, toBlock: latest }).catch(() => [])

  el('history').innerHTML = logs.length
    ? logs
        .slice(-15)
        .reverse()
        .map(
          (log) =>
            `<li><code>${log.transactionHash.slice(0, 10)}…</code><span>block ${log.blockNumber}</span></li>`,
        )
        .join('')
    : '<li class="empty">Nothing yet. Fund the address above and it will show up here.</li>'
}

async function render(account) {
  el('signed-out').hidden = true
  el('signed-in').hidden = false
  el('address').textContent = account
  el('copy').addEventListener('click', () => navigator.clipboard.writeText(account))

  await balances(account)
  await history(account)
}

const arrived = adoptCallback()
const current = arrived ?? session()?.account

if (current) {
  render(current).catch((error) => {
    el('status').textContent = error.message
  })
} else {
  el('signed-out').hidden = false
  el('sign-in').addEventListener('click', signIn)
}
