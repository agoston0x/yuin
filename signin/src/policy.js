/**
 * What this app requires.
 *
 * Read from AppRegistry at load time rather than shipped with the page, so a developer
 * who tightens their rules at 4pm has tightened them for everyone at 4pm. It also means
 * the page cannot quietly ask for less than the app demanded — the list it renders is the
 * list on chain.
 */
import { createPublicClient, http, keccak256, toHex, zeroHash } from 'viem'
import { sepolia } from 'viem/chains'
import { config } from './config.js'

const client = createPublicClient({ chain: sepolia, transport: http(config.rpc) })

const appRegistryAbi = [
  {
    type: 'function',
    name: 'appOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'stake', type: 'uint256' },
          { name: 'aud', type: 'string' },
          { name: 'gateway', type: 'string' },
          { name: 'frontendHash', type: 'bytes32' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'policyFor',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [{ type: 'bytes32[]' }],
  },
]

export const KINDS = {
  [keccak256(toHex('google'))]: 'google',
  [keccak256(toHex('email'))]: 'email',
  [keccak256(toHex('passkey'))]: 'passkey',
  [keccak256(toHex('world.selfie'))]: 'world.selfie',
  [keccak256(toHex('world.age'))]: 'world.age',
}

export function appIdFor(label) {
  return keccak256(toHex(label))
}

export async function appRecord(appId) {
  return client.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'appOf',
    args: [appId],
  })
}

/** `action` of null means the login policy. */
export async function policyFor(appId, action = null) {
  const kinds = await client.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'policyFor',
    args: [appId, action ? keccak256(toHex(action)) : zeroHash],
  })
  // An unrecognised kind is reported as its hash rather than dropped: a page that cannot
  // satisfy a requirement should say so, not pretend the requirement is not there.
  return kinds.map((hash) => KINDS[hash] ?? hash)
}
