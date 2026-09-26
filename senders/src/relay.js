/**
 * Paying the gas so a new user does not have to.
 *
 * Someone signing up has no ether, and asking them to acquire some before they have an
 * account is the end of the conversation. So a sender broadcasts the transaction.
 *
 * Being clear about what this does and does not mean. The relayer cannot alter the call:
 * every field is inside the digest both senders signed, so changing any of them makes the
 * signatures fail on chain. It can refuse, and it can stall — and because `createAccount`
 * is permissionless, anyone with ether can submit the same transaction themselves, which
 * is the escape hatch that keeps this a convenience rather than a gatekeeper.
 */
import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as chains from 'viem/chains'
import { config } from './config.js'
import { emailIdentityRegistryAbi } from './abi.js'

/**
 * Whichever chain the registry is actually on. Hardcoding one means a sender pointed at a
 * local chain silently refuses to sign anything, which is a baffling half hour.
 */
function chainFor(id) {
  const known = Object.values(chains).find((c) => c?.id === id)
  if (known) return known
  return defineChain({
    id,
    name: `chain ${id}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpc] } },
  })
}

const chain = chainFor(config.chainId)
const account = privateKeyToAccount(config.privateKey)
const transport = http(config.rpc)

export const publicClient = createPublicClient({ chain, transport })
const walletClient = createWalletClient({ account, chain, transport })

export { walletClient }

export async function accountFor(identityHash) {
  return publicClient.readContract({
    address: config.registry,
    abi: emailIdentityRegistryAbi,
    functionName: 'accountOf',
    args: [identityHash],
  })
}

export async function submit({ identityHash, firstOwner, nonce, expiry, signatures }) {
  // Simulated first, so a call that would revert costs nobody any gas and comes back as
  // a readable error rather than a failed transaction.
  const { request } = await publicClient.simulateContract({
    account,
    address: config.registry,
    abi: emailIdentityRegistryAbi,
    functionName: 'createAccount',
    args: [identityHash, firstOwner, BigInt(nonce), BigInt(expiry), signatures],
  })

  const hash = await walletClient.writeContract(request)
  await publicClient.waitForTransactionReceipt({ hash })
  return { hash, account: await accountFor(identityHash) }
}

/**
 * A little gas for a key that was made a minute ago.
 *
 * The owner key can drive the account — it is an owner — but it cannot pay for the
 * privilege, and telling a new user to go and acquire testnet ether before they can do
 * anything is where the demonstration ends.
 *
 * This is Yuin paying, openly, because there is no paymaster yet. It is capped per
 * address and it is not a faucet: the amount covers a handful of transactions and no
 * more. A real deployment puts a paymaster here with a policy scoped to the app.
 */
const DRIP = 3000000000000000n // 0.003 ETH, a few transactions' worth
const dripped = new Set()

export async function drip(owner) {
  const key = owner.toLowerCase()
  if (dripped.has(key)) return { sent: false, reason: 'already funded' }

  const balance = await publicClient.getBalance({ address: owner })
  if (balance >= DRIP) return { sent: false, reason: 'already has gas' }

  dripped.add(key)
  const hash = await walletClient.sendTransaction({ to: owner, value: DRIP })
  await publicClient.waitForTransactionReceipt({ hash })
  return { sent: true, hash, amount: DRIP.toString() }
}
