/** Everything this node needs to know, read once, with the obvious complaints up front. */

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set — see .env.example`)
  return value
}

export const config = {
  privateKey: required('NODE_PRIVATE_KEY'),
  rpc: required('SEPOLIA_RPC'),
  contracts: {
    identityRegistry: required('IDENTITY_REGISTRY'),
    appRegistry: required('APP_REGISTRY'),
    nodeRegistry: required('NODE_REGISTRY'),
    accountFactory: required('ACCOUNT_FACTORY'),
  },
  salt: process.env.CREDENTIAL_SALT ?? '0x' + '00'.repeat(32),
  bee: {
    api: process.env.BEE_API ?? 'http://bee:1633',
    batch: process.env.POSTAGE_BATCH_ID ?? null,
    topic: process.env.GSOC_TOPIC ?? 'manju/shares/v1',
  },
  port: Number(process.env.PORT ?? 8700),
  gateway: process.env.GATEWAY_URL ?? '',
}
