/**
 * Ask for more, per action.
 *
 * What an action demands lives on chain and is read at the moment of the call, so a
 * developer who adds a requirement at 4pm has added it for everyone at 4pm, with nothing
 * redeployed and no version of the app still running the old rules.
 *
 * A refusal comes back as a value, not an exception. "You cannot bid until you verify" is
 * a screen an app draws; making it a thrown error would push every integrator into a
 * try/catch and produce worse interfaces for their users.
 */
import { keccak256, toHex, zeroHash, type PublicClient } from 'viem'
import { appRegistryAbi } from './abi.js'
import type { Contracts, StepUp } from './types.js'

export const KIND_NAMES: Record<string, string> = {
  [keccak256(toHex('google'))]: 'google',
  [keccak256(toHex('email'))]: 'email',
  [keccak256(toHex('passkey'))]: 'passkey',
  [keccak256(toHex('world.selfie'))]: 'world.selfie',
  [keccak256(toHex('world.age'))]: 'world.age',
}

export async function policyFor(
  client: PublicClient,
  contracts: Contracts,
  appId: `0x${string}`,
  action: string | null,
): Promise<string[]> {
  const kinds = await client.readContract({
    address: contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'policyFor',
    args: [appId, action ? keccak256(toHex(action)) : zeroHash],
  })
  // An unrecognised kind keeps its hash rather than disappearing: a client that cannot
  // satisfy a requirement must say so, not behave as though it were not there.
  return (kinds as readonly `0x${string}`[]).map((hash) => KIND_NAMES[hash] ?? hash)
}

/**
 * Which of an action's requirements this identity has not met.
 *
 * Credentials already linked to the identity count as met; the rest are what the app must
 * send the user off to do.
 */
export function evaluate(required: string[], held: string[]): StepUp {
  const missing = required.filter((kind) => !held.includes(kind))
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
