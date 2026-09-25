/**
 * The entry point.
 *
 * One ENS name is the only constant in here. Registry addresses, node gateways and the
 * sign-in page all resolve from it, which is what lets the protocol move without every
 * app redeploying — and lets a cautious app pin an address instead.
 */
import type { ClientConfig } from './types.js'

export function createClient(config: ClientConfig) {
  throw new Error('not implemented')
}
