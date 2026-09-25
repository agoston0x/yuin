/**
 * The chain client. It reads who the peers are and what each app demands, and it writes
 * the result of a verification. It holds one key, its own operator key, and that key can
 * do nothing except attest — it is not an owner of anybody's account.
 */
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { config } from './config.js'
import { accountFactoryAbi, appRegistryAbi, identityRegistryAbi, nodeRegistryAbi } from './abi.js'

export const account = privateKeyToAccount(config.privateKey)

export const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpc) })
export const walletClient = createWalletClient({ account, chain: sepolia, transport: http(config.rpc) })

export const chainId = sepolia.id

export async function threshold() {
  return publicClient.readContract({
    address: config.contracts.nodeRegistry,
    abi: nodeRegistryAbi,
    functionName: 'threshold',
  })
}

export async function activeNodes() {
  const addresses = await publicClient.readContract({
    address: config.contracts.nodeRegistry,
    abi: nodeRegistryAbi,
    functionName: 'activeSet',
  })

  return Promise.all(
    addresses.map(async (operator) => {
      const [stake, gateway] = await publicClient.readContract({
        address: config.contracts.nodeRegistry,
        abi: nodeRegistryAbi,
        functionName: 'nodes',
        args: [operator],
      })
      return { operator, stake, gateway }
    }),
  )
}

export async function appRecord(appId) {
  return publicClient.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'appOf',
    args: [appId],
  })
}

export async function policyFor(appId, action) {
  return publicClient.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'policyFor',
    args: [appId, action],
  })
}

export async function identityOf(credentialHash) {
  return publicClient.readContract({
    address: config.contracts.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'identityOf',
    args: [credentialHash],
  })
}

export async function personalAddress(credentialHash, firstOwner) {
  return publicClient.readContract({
    address: config.contracts.accountFactory,
    abi: accountFactoryAbi,
    functionName: 'personalAddress',
    args: [credentialHash, firstOwner],
  })
}

export async function appAddress(credentialHash, appId, firstOwner) {
  return publicClient.readContract({
    address: config.contracts.accountFactory,
    abi: accountFactoryAbi,
    functionName: 'appAddress',
    args: [credentialHash, appId, firstOwner],
  })
}

/**
 * Deploy the account, then link the credential to it.
 *
 * In that order, and not the other way round: the registry entry is the permanent one, so
 * nothing should point at an address that failed to come into existence.
 */
export async function deployAndLink({ credentialHash, appId, firstOwner, signatures }) {
  const deployHash = await walletClient.writeContract({
    address: config.contracts.accountFactory,
    abi: accountFactoryAbi,
    functionName: appId ? 'deployForApp' : 'deployPersonal',
    args: appId ? [credentialHash, appId, firstOwner] : [credentialHash, firstOwner],
  })
  await publicClient.waitForTransactionReceipt({ hash: deployHash })

  const identity = appId
    ? await appAddress(credentialHash, appId, firstOwner)
    : await personalAddress(credentialHash, firstOwner)

  const linkHash = await walletClient.writeContract({
    address: config.contracts.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'link',
    args: [credentialHash, identity, signatures],
  })
  await publicClient.waitForTransactionReceipt({ hash: linkHash })

  return { identity, deployHash, linkHash }
}
