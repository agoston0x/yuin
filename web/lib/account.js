/**
 * Driving the smart account from the browser.
 *
 * The owner key made at sign-up can call `execute` on the account directly — it is an
 * owner, and the account checks that before anything else. No bundler, no paymaster, no
 * user operation: just a transaction, which is a great deal simpler to demonstrate and
 * exactly as non-custodial.
 *
 * The catch is that the owner key pays gas, and a key made thirty seconds ago has none.
 * A sender drips it a little at sign-up. That is Yuin sponsoring the demo rather than a
 * paymaster doing it properly, and the page says so rather than glossing over it.
 */
import { createPublicClient, createWalletClient, formatUnits, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { erc20Abi } from './uniswap'
import { TOKENS } from './tokens'

const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'

export const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) })

export const accountAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address[]' }, { type: 'uint256[]' }, { type: 'bytes[]' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addPasskey',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setP256Verifier',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'passkeyCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isOwner',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
]

export function walletFor(privateKey) {
  return createWalletClient({ account: privateKeyToAccount(privateKey), chain: sepolia, transport: http(RPC) })
}

export async function balances(account) {
  const native = await publicClient.getBalance({ address: account })

  const rows = await Promise.all(
    TOKENS.map(async (token) => {
      if (token.native) {
        return { ...token, raw: native, formatted: formatUnits(native, 18) }
      }
      const raw = await publicClient
        .readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
        .catch(() => 0n)
      return { ...token, raw, formatted: formatUnits(raw, token.decimals) }
    }),
  )

  return rows
}

/** One call through the account, waited on, so the caller can show a result not a hope. */
export async function execute(privateKey, account, { to, value, data }) {
  const wallet = walletFor(privateKey)
  const hash = await wallet.writeContract({
    address: account,
    abi: accountAbi,
    functionName: 'execute',
    args: [to, value, data],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

/** Several calls, atomically. A swap that needs an approval is one transaction, not two. */
export async function executeBatch(privateKey, account, calls) {
  const wallet = walletFor(privateKey)
  const hash = await wallet.writeContract({
    address: account,
    abi: accountAbi,
    functionName: 'executeBatch',
    args: [calls.map((c) => c.to), calls.map((c) => c.value), calls.map((c) => c.data)],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function ownerGas(owner) {
  return publicClient.getBalance({ address: owner })
}
