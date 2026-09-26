/**
 * Paying for someone else's first transaction.
 *
 * A smart account that has never been used has no ether, and telling a new user to go and
 * acquire some is where most of them leave. A paymaster covers the gas so the first thing
 * they do can be the thing they came to do.
 *
 * The policy is scoped to the app: what gets sponsored is calls this app's account makes,
 * not anything the holder of a session key fancies. A paymaster with no policy is a
 * faucet, and it drains at exactly the speed someone notices it.
 */
import type { Address, Hex } from 'viem'

export interface SponsorConfig {
  /** Pimlico endpoint for the chain, including the API key. Server-held, never shipped. */
  bundlerUrl: string
  /** Only operations from accounts of this app are paid for. */
  appId: Hex
  /** A ceiling, so a mistake costs a known amount rather than the balance. */
  maxSponsoredWei?: bigint
}

export interface UserOperation {
  sender: Address
  nonce: bigint
  callData: Hex
  [key: string]: unknown
}

/**
 * Ask the paymaster to cover an operation.
 *
 * Returns the fields to merge into the user operation, or null when the policy declines —
 * a refusal is an answer, and an app that can't tell the difference between "declined"
 * and "broken" will show its user the wrong thing.
 */
export async function sponsor(
  config: SponsorConfig,
  userOp: UserOperation,
): Promise<Record<string, Hex> | null> {
  const response = await fetch(config.bundlerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_sponsorUserOperation',
      params: [userOp, { sponsorshipPolicyId: config.appId }],
    }),
  })

  const body = (await response.json()) as { result?: Record<string, Hex>; error?: { message: string } }
  if (body.error) return null
  return body.result ?? null
}

/**
 * Where an account will be before it exists.
 *
 * Worth exposing on its own: it lets an app show someone their address, and lets anyone
 * fund it, while the account is still counterfactual. The first transaction then deploys
 * it and spends the money that was already waiting.
 */
export async function isDeployed(client: { getCode: (a: { address: Address }) => Promise<Hex | undefined> }, address: Address) {
  const code = await client.getCode({ address })
  return Boolean(code && code !== '0x')
}
