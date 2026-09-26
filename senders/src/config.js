/** Everything this sender needs, with the obvious complaints up front. */

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set — see .env.example`)
  return value
}

export const config = {
  label: process.env.SENDER_LABEL ?? 'Yuin',
  privateKey: required('SENDER_PRIVATE_KEY'),
  chainId: Number(process.env.CHAIN_ID ?? 11155111),
  registry: required('EMAIL_IDENTITY_REGISTRY'),
  rpc: process.env.SEPOLIA_RPC ?? 'https://ethereum-sepolia-rpc.publicnode.com',
  // Optional: without it the Google path returns 501 rather than pretending to work.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
  port: Number(process.env.PORT ?? 8760),
  mail: {
    key: process.env.MAIL_PROVIDER_API_KEY ?? null,
    from: process.env.MAIL_FROM ?? null,
  },
}
