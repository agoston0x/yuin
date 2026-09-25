/** Baked in at build time; the sign-in page's URL and the registry addresses. */
export const config = {
  rpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
  signinUrl: process.env.SIGNIN_URL || 'http://localhost:8720',
  ensRoot: process.env.ENS_ROOT || 'manju.eth',
  contracts: {
    nodeRegistry: process.env.NODE_REGISTRY || '',
    appRegistry: process.env.APP_REGISTRY || '',
    identityRegistry: process.env.IDENTITY_REGISTRY || '',
    accountFactory: process.env.ACCOUNT_FACTORY || '',
    appResolver: process.env.APP_RESOLVER || '',
  },
}
