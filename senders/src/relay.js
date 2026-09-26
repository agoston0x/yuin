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
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { config } from './config.js'
import { emailIdentityRegistryAbi } from './abi.js'

const account = privateKeyToAccount(config.privateKey)
const transport = http(config.rpc)

export const publicClient = createPublicClient({ chain: sepolia, transport })
const walletClient = createWalletClient({ account, chain: sepolia, transport })

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
