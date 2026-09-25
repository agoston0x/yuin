export interface Contracts {
  nodeRegistry: `0x${string}`
  appRegistry: `0x${string}`
  identityRegistry: `0x${string}`
  accountFactory: `0x${string}`
}

export interface ClientConfig {
  /** The app's label — the same one that resolves as `<label>.app.manju.eth`. */
  app: string
  /** Where the shared sign-in page lives. One fixed origin, because passkeys are bound to one. */
  signinUrl?: string
  rpc?: string
  /** Pin addresses instead of resolving them, for an app that would rather not move. */
  contracts?: Partial<Contracts>
}

export interface Session {
  /** The account this identity uses in this app. */
  account: `0x${string}`
  /** The session key's address, registered on the account with a TTL and a cap. */
  key: `0x${string}`
  expiresAt: number
}

/** Refusal is a state the UI renders, not an error it catches. */
export type StepUp = { ok: true } | { ok: false; missing: string[] }
