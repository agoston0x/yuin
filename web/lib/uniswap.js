/**
 * Swapping, from a smart account.
 *
 * The account calls Uniswap's router directly through its own `execute`, so there is no
 * approval dance for the common case: `exactInputSingle` is payable, and passing ETH as
 * value with WETH as the input token makes the router wrap it on the way in. One call,
 * one signature, and the USDC lands in the account.
 *
 * Going the other way needs an approval first, because the router has to pull the token.
 * That is two calls rather than one, and it is worth knowing which case you are in before
 * telling a user how long this will take.
 */
import { encodeFunctionData, parseUnits } from 'viem'
import { FEES, UNISWAP, WETH } from './tokens'

export const quoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'ticksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
]

export const routerAbi = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
]

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
]

/**
 * Ask every tier and take the best answer.
 *
 * Pools differ in depth by an order of magnitude here, and picking the wrong one is the
 * difference between a clean rate and a visibly bad one. Asking all three costs three
 * reads and no gas.
 */
export async function bestQuote(client, { tokenIn, tokenOut, amountIn }) {
  const results = await Promise.all(
    FEES.map(async (fee) => {
      try {
        const { result } = await client.simulateContract({
          address: UNISWAP.quoter,
          abi: quoterAbi,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
        })
        return { fee, amountOut: result[0] }
      } catch {
        return null
      }
    }),
  )

  const best = results.filter(Boolean).sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1))[0]
  if (!best) throw new Error('no pool could quote that swap')
  return best
}

/** Slippage as a floor, not a hope: the swap either clears it or reverts. */
export function withSlippage(amountOut, percent = 1) {
  return (amountOut * BigInt(Math.round((100 - percent) * 100))) / 10000n
}

/**
 * The calls an account makes to perform a swap.
 *
 * Returned as a list because the number of them depends on the direction, and the caller
 * should be able to tell a user "two confirmations" before they start rather than after.
 */
export function swapCalls({ account, tokenIn, tokenOut, amountIn, amountOutMinimum, fee, fromNative }) {
  const swap = {
    to: UNISWAP.swapRouter,
    value: fromNative ? amountIn : 0n,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: fromNative ? WETH : tokenIn,
          tokenOut,
          fee,
          recipient: account,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
  }

  if (fromNative) return [swap]

  // The router pulls the token, so it has to be allowed to first.
  return [
    {
      to: tokenIn,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP.swapRouter, amountIn] }),
    },
    swap,
  ]
}

export function parseAmount(value, decimals) {
  return parseUnits(String(value), decimals)
}
