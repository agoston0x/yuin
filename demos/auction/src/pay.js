/**
 * A bid in one token against a price quoted in another.
 *
 * The lot is 48,000 JPY. The bidder holds USDC. An exact-output swap buys exactly the
 * yen owed, the transfer pays it, and the sweep returns the change — three commands in one
 * Universal Router call, inside one user operation. The bidder signs once and never sees a
 * swap screen, which is the difference between a crypto app and an app.
 *
 * Addresses come from configuration. A router address that is merely plausible is worse
 * than none, so if they are unset this path says so rather than sending money somewhere.
 */
import { uniswap } from '@manju/sdk'
import { parseUnits } from 'viem'

const PRICE_TOKEN = process.env.PRICE_TOKEN || ''
const PAY_TOKEN = process.env.PAY_TOKEN || ''
const POOL_FEE = 3000

export function configured() {
  return Boolean(PRICE_TOKEN && PAY_TOKEN)
}

/**
 * What to send to the router. Slippage is a ceiling on what the bidder can spend, not a
 * guess at a price: the exact-output swap either buys the yen for that or fails.
 */
export function bidCalldata({ account, auctionAddress, priceJpy, maxSpend, decimals = 6 }) {
  if (!configured()) throw new Error('no tokens configured for this demo')

  return uniswap.payInAnyToken({
    payFrom: account,
    payTo: auctionAddress,
    priceToken: PRICE_TOKEN,
    fromToken: PAY_TOKEN,
    amountOwed: parseUnits(String(priceJpy), decimals),
    maxToSpend: parseUnits(String(maxSpend), decimals),
    fee: POOL_FEE,
  })
}
