/**
 * One name, and everything else follows.
 *
 * The SDK knows a single ENS name. Registry addresses, the sign-in page, the node
 * gateways — all of it resolves from that name's text records, so the protocol can move
 * without every app redeploying. An app that would rather not move can pin addresses and
 * skip this entirely; that is a legitimate choice, not a workaround.
 */
import { createPublicClient, http, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import type { Contracts } from './types.js'

export const ROOT = 'yuin.eth'

const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

export function publicClient(rpc = DEFAULT_RPC): PublicClient {
  return createPublicClient({ chain: sepolia, transport: http(rpc) }) as PublicClient
}

const KEYS: Record<keyof Contracts, string> = {
  nodeRegistry: 'yuin.nodeRegistry',
  appRegistry: 'yuin.appRegistry',
  identityRegistry: 'yuin.identityRegistry',
  accountFactory: 'yuin.accountFactory',
}

export async function resolveContracts(client: PublicClient, pinned?: Partial<Contracts>): Promise<Contracts> {
  const entries = await Promise.all(
    (Object.keys(KEYS) as (keyof Contracts)[]).map(async (name) => {
      if (pinned?.[name]) return [name, pinned[name]] as const
      const value = await client.getEnsText({ name: ROOT, key: KEYS[name] })
      if (!value) throw new Error(`${ROOT} publishes no ${KEYS[name]} — pin the address instead`)
      return [name, value as `0x${string}`] as const
    }),
  )
  return Object.fromEntries(entries) as unknown as Contracts
}

export async function resolveSigninUrl(client: PublicClient): Promise<string> {
  const url = await client.getEnsText({ name: ROOT, key: 'yuin.signin' })
  if (!url) throw new Error(`${ROOT} publishes no sign-in URL`)
  return url
}
