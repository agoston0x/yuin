/**
 * Baked in at build time, because a static page has nowhere else to read from.
 *
 * Only two things are genuinely constant: the chain and the registry addresses. Everything
 * about a particular app — its OAuth client, what it demands of a user — is read from that
 * app's own records at runtime.
 */
export const config = {
  rpc: process.env.SEPOLIA_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com',
  contracts: {
    nodeRegistry: process.env.NODE_REGISTRY ?? '0x0000000000000000000000000000000000000000',
    appRegistry: process.env.APP_REGISTRY ?? '0x0000000000000000000000000000000000000000',
    identityRegistry: process.env.IDENTITY_REGISTRY ?? '0x0000000000000000000000000000000000000000',
    accountFactory: process.env.ACCOUNT_FACTORY ?? '0x0000000000000000000000000000000000000000',
  },
  worldAppId: process.env.WORLD_APP_ID ?? '',
}
