/**
 * The whole surface an app touches.
 *
 *   const yuin = await createClient({ app: 'auction' })
 *   if (!yuin.session) yuin.login()
 *   const gate = await yuin.verify('bid')
 *
 * Four lines to a signed-in user with a smart account. What the app does not get is a
 * token, an email address, or any way to identify the person outside this app — which is
 * less than a conventional auth library hands over, deliberately.
 */
import type { Address, PublicClient } from 'viem'
import { publicClient, resolveContracts, resolveSigninUrl } from './discovery.js'
import * as login from './login.js'
import * as session from './session.js'
import { evaluate, policyFor } from './verify.js'
import { balances } from './accounts.js'
import type { ClientConfig, Contracts, Session, StepUp } from './types.js'

export interface Client {
  appId: `0x${string}`
  contracts: Contracts
  client: PublicClient
  session: Session | null
  login(): never
  logout(): void
  loginPolicy(): Promise<string[]>
  policyFor(action: string): Promise<string[]>
  verify(action: string, held?: string[]): Promise<StepUp>
  balances(tokens?: Address[]): Promise<Awaited<ReturnType<typeof balances>>>
}

export async function createClient(config: ClientConfig): Promise<Client> {
  const client = publicClient(config.rpc)
  const contracts = await resolveContracts(client, config.contracts)
  const signinUrl = config.signinUrl ?? (await resolveSigninUrl(client))
  const appId = login.appIdFor(config.app)

  // A redirect may have just landed; take the result before anything reads the session.
  login.finish()

  const stored = session.load()
  const current: Session | null =
    stored?.account != null
      ? { account: stored.account, key: stored.address, expiresAt: stored.expiresAt ?? 0 }
      : null

  return {
    appId,
    contracts,
    client,
    session: current,

    login() {
      return login.start({ signinUrl, app: config.app })
    },

    logout() {
      session.clear()
    },

    loginPolicy() {
      return policyFor(client, contracts, appId, null)
    },

    policyFor(action: string) {
      return policyFor(client, contracts, appId, action)
    },

    /**
     * What is still missing for this action. An app renders the answer; it does not have
     * to know which credentials exist or how any of them work.
     */
    async verify(action: string, held: string[] = []) {
      return evaluate(await policyFor(client, contracts, appId, action), held)
    },

    balances(tokens: Address[] = []) {
      if (!current) throw new Error('nobody is signed in')
      return balances(client, current.account, tokens)
    },
  }
}
