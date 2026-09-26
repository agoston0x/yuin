/**
 * Sepolia, and what is actually tradeable on it.
 *
 * Checked rather than assumed: the 1% pool holds around 1,190 WETH against 35M USDC, so a
 * demo swap moves the price by nothing worth mentioning. The 0.05% pool is thinner but
 * still deep enough; it is the default because the fee is lower and the depth is ample
 * for the sizes anyone will try here.
 */
export const CHAIN_ID = 11155111

export const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
export const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

export const UNISWAP = {
  swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  quoter: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
  factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
}

/** Fee tiers with real depth on Sepolia, best first. */
export const FEES = [500, 3000, 10000]

export const TOKENS = [
  { symbol: 'ETH', address: null, decimals: 18, native: true },
  { symbol: 'WETH', address: WETH, decimals: 18 },
  { symbol: 'USDC', address: USDC, decimals: 6 },
]

export function tokenBySymbol(symbol) {
  return TOKENS.find((t) => t.symbol === symbol)
}
