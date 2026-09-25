export interface ClientConfig {
  appId: string
  /** Pin protocol addresses instead of resolving them, for an app that would rather not move. */
  pin?: Record<string, string>
}

export interface Session {
  identity: string
  account: string
  expiry: number
}

/** Refusal is a state the UI renders, not an error it catches. */
export type StepUpResult = { ok: true } | { ok: false; missing: string[] }
