/**
 * One identity, several accounts.
 *
 * The personal account holds funds and is what the dashboard shows. A per-app account is
 * derived from the identity and the app together, so the same person appears at a
 * different address in every app they use: two apps comparing notes learn nothing, and an
 * app that is compromised exposes only its own account.
 *
 * History is read from the chain rather than from anyone's database, which is why this
 * and a block explorer cannot tell different stories.
 */
import { formatUnits, type Address, type PublicClient } from 'viem'
import { erc20Abi } from './abi.js'

export interface TokenBalance {
  token: Address | 'native'
  symbol: string
  decimals: number
  raw: bigint
  formatted: string
}

export async function nativeBalance(client: PublicClient, account: Address): Promise<TokenBalance> {
  const raw = await client.getBalance({ address: account })
  return { token: 'native', symbol: 'ETH', decimals: 18, raw, formatted: formatUnits(raw, 18) }
}

export async function tokenBalance(client: PublicClient, account: Address, token: Address): Promise<TokenBalance> {
  const [raw, decimals, symbol] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
  ])
  return {
    token,
    symbol: symbol as string,
    decimals: Number(decimals),
    raw: raw as bigint,
    formatted: formatUnits(raw as bigint, Number(decimals)),
  }
}

export async function balances(client: PublicClient, account: Address, tokens: Address[]): Promise<TokenBalance[]> {
  const all = await Promise.all([
    nativeBalance(client, account),
    ...tokens.map((token) => tokenBalance(client, account, token)),
  ])
  return all
}
