/**
 * One identity, several accounts. The personal one holds funds; a per-app one is what
 * this app sees, derived from `(identity, appId)` so two apps cannot correlate the same
 * person.
 */

export async function personal(): Promise<string> {
  throw new Error('not implemented')
}

export async function forApp(appId: string): Promise<string> {
  throw new Error('not implemented')
}

export async function balances(account: string): Promise<unknown> {
  throw new Error('not implemented')
}

export async function history(account: string): Promise<unknown> {
  throw new Error('not implemented')
}
