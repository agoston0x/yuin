/**
 * Universal Router and Permit2, wrapped so that "pay 5000 JPY" works for someone holding
 * only USDC. The quote and the swap ride inside the same user operation as the payment,
 * so the user signs once and never sees a swap screen they did not ask for.
 */

export async function quote(args: unknown): Promise<unknown> {
  throw new Error('not implemented')
}

export async function swap(args: unknown): Promise<string> {
  throw new Error('not implemented')
}

/** Exact-output swap, then transfer. */
export async function payInAnyToken(args: unknown): Promise<string> {
  throw new Error('not implemented')
}

export async function autoConvertOnReceive(args: unknown): Promise<string> {
  throw new Error('not implemented')
}
