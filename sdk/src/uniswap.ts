/**
 * Paying in whatever you happen to hold.
 *
 * An auction quotes a lot in a JPY stablecoin. The bidder has USDC. Without this, that is
 * a swap screen, a second approval, a wait, and then the actual bid — four steps, three of
 * which are about plumbing. With it, the swap and the payment are two commands in one
 * Universal Router call inside one user operation: the bidder signs once and the JPY is
 * exact, because an exact-output swap buys precisely the amount owed and returns the rest.
 *
 * Addresses are configuration, not constants. Uniswap's deployments differ per chain and a
 * hardcoded router that happens to be wrong is worse than one that is absent, so these are
 * read from the protocol's records and must be set before any of this is used.
 */
import { encodeAbiParameters, encodePacked, concat, type Address, type Hex } from 'viem'

/** Universal Router command bytes, only the ones used here. */
export const Command = {
  V3_SWAP_EXACT_IN: 0x00,
  V3_SWAP_EXACT_OUT: 0x01,
  SWEEP: 0x04,
  TRANSFER: 0x05,
} as const

export interface RouterConfig {
  universalRouter: Address
  permit2: Address
}

/**
 * A v3 path. For an exact-output swap it runs backwards — tokenOut first — because the
 * router works out what to sell by walking from what you want to what you have.
 */
export function encodePath(tokens: Address[], fees: number[]): Hex {
  if (tokens.length !== fees.length + 1) throw new Error('a path needs one more token than it has fees')
  let types: string[] = ['address']
  let values: unknown[] = [tokens[0]]
  for (let i = 0; i < fees.length; i++) {
    types.push('uint24', 'address')
    values.push(fees[i], tokens[i + 1])
  }
  return encodePacked(types as never, values as never)
}

export interface ExactOutputSwap {
  recipient: Address
  amountOut: bigint
  amountInMax: bigint
  /** tokenOut → fee → tokenIn */
  path: Hex
}

export function encodeExactOutput({ recipient, amountOut, amountInMax, path }: ExactOutputSwap): Hex {
  return encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }, { type: 'bool' }],
    [recipient, amountOut, amountInMax, path, true],
  )
}

export function encodeTransfer(token: Address, recipient: Address, amount: bigint): Hex {
  return encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], [
    token,
    recipient,
    amount,
  ])
}

/** Anything the swap did not need goes back to the payer rather than staying in the router. */
export function encodeSweep(token: Address, recipient: Address, minimum: bigint = 0n): Hex {
  return encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], [
    token,
    recipient,
    minimum,
  ])
}

export function commandBytes(commands: number[]): Hex {
  return concat(commands.map((c) => encodePacked(['uint8'], [c]))) as Hex
}

/**
 * Buy exactly what is owed, pay it to whoever is owed it, and return the change — one
 * call, so there is no moment where the swap has happened and the payment has not.
 */
export function payInAnyToken(args: {
  payFrom: Address
  payTo: Address
  priceToken: Address
  fromToken: Address
  amountOwed: bigint
  maxToSpend: bigint
  fee: number
}) {
  const path = encodePath([args.priceToken, args.fromToken], [args.fee])
  return {
    commands: commandBytes([Command.V3_SWAP_EXACT_OUT, Command.TRANSFER, Command.SWEEP]),
    inputs: [
      encodeExactOutput({
        recipient: args.payFrom,
        amountOut: args.amountOwed,
        amountInMax: args.maxToSpend,
        path,
      }),
      encodeTransfer(args.priceToken, args.payTo, args.amountOwed),
      encodeSweep(args.fromToken, args.payFrom),
    ],
  }
}
