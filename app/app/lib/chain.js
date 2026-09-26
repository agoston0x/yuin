/**
 * The chain, from a browser.
 *
 * Reading needs nothing from anyone. Writing is the developer's own wallet, because the
 * app record should belong to them and not to anything we operate — if we could edit it,
 * the public registry would be worth nothing.
 */
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { sepolia } from 'viem/chains'

export const config = {
  rpc: process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
  appRegistry: process.env.NEXT_PUBLIC_APP_REGISTRY || '',
  appResolver: process.env.NEXT_PUBLIC_APP_RESOLVER || '',
  ensRoot: process.env.NEXT_PUBLIC_ENS_ROOT || 'yuin.eth',
}

export const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpc) })

export async function connect() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('no wallet found — install MetaMask to register an app')
  }

  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  const chainId = await window.ethereum.request({ method: 'eth_chainId' })

  if (Number(chainId) !== sepolia.id) {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + sepolia.id.toString(16) }],
    })
  }

  return { account, client: createWalletClient({ account, chain: sepolia, transport: custom(window.ethereum) }) }
}

export function waitFor(hash) {
  return publicClient.waitForTransactionReceipt({ hash })
}
