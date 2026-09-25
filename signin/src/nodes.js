/**
 * Where the gateways are.
 *
 * Read from NodeRegistry rather than hardcoded, so the set of people who can sign anyone
 * in is a matter of public record and not of what this file happened to say on the day it
 * was built.
 *
 * A login is posted to all of them at once. The first complete answer wins; the others
 * were doing the same work anyway, and a node being slow should not be a user's problem.
 */
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { config } from './config.js'

const client = createPublicClient({ chain: sepolia, transport: http(config.rpc) })

const nodeRegistryAbi = [
  { type: 'function', name: 'activeSet', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  {
    type: 'function',
    name: 'nodes',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [
      { name: 'stake', type: 'uint256' },
      { name: 'gateway', type: 'string' },
      { name: 'thresholdPubKey', type: 'bytes' },
      { name: 'unbondingAt', type: 'uint64' },
      { name: 'index', type: 'uint32' },
    ],
  },
]

let cached = null

export async function gateways() {
  if (cached) return cached
  const operators = await client.readContract({
    address: config.contracts.nodeRegistry,
    abi: nodeRegistryAbi,
    functionName: 'activeSet',
  })

  const found = await Promise.all(
    operators.map(async (operator) => {
      const [, gateway] = await client.readContract({
        address: config.contracts.nodeRegistry,
        abi: nodeRegistryAbi,
        functionName: 'nodes',
        args: [operator],
      })
      return gateway
    }),
  )

  cached = found.filter(Boolean)
  if (cached.length === 0) throw new Error('no nodes are registered, so nobody can verify a login')
  return cached
}

export async function post(path, body) {
  const urls = await gateways()
  const attempts = urls.map(async (url) => {
    const response = await fetch(new URL(path, url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `node at ${url} refused`)
    return data
  })

  return Promise.any(attempts).catch((error) => {
    const reasons = error.errors?.map((e) => e.message).join('; ') ?? error.message
    throw new Error(`no node completed the request: ${reasons}`)
  })
}
