/**
 * The chain, from a browser.
 *
 * Reading needs nothing from the user. Writing — registering an app, changing a policy —
 * is the developer's own wallet, because the app record should belong to them and not to
 * anything we operate.
 */
import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { sepolia } from 'viem/chains'
import { config } from './config.js'

export const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpc) })

export async function wallet() {
  if (!window.ethereum) throw new Error('no wallet found — install MetaMask to register an app')

  const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  const chainId = await window.ethereum.request({ method: 'eth_chainId' })

  if (Number(chainId) !== sepolia.id) {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + sepolia.id.toString(16) }],
    })
  }

  return {
    account,
    client: createWalletClient({ account, chain: sepolia, transport: custom(window.ethereum) }),
  }
}

export async function waitFor(hash) {
  return publicClient.waitForTransactionReceipt({ hash })
}
