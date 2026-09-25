/**
 * The only file that knows about Manju. Everything else in this app is ordinary code.
 *
 * Worth reading as the answer to "how much do I have to change?": one import, one
 * `createClient`, and the app has signed-in users with smart accounts.
 */
import { createClient } from '@manju/sdk'

export const client = await createClient({
  app: process.env.APP_LABEL || 'boilerplate',
  signinUrl: process.env.SIGNIN_URL,
  rpc: process.env.SEPOLIA_RPC,
  contracts: {
    appRegistry: process.env.APP_REGISTRY,
    nodeRegistry: process.env.NODE_REGISTRY,
    identityRegistry: process.env.IDENTITY_REGISTRY,
    accountFactory: process.env.ACCOUNT_FACTORY,
  },
})
