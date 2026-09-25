/**
 * The credentials a developer can ask for, in the order a person would think of them.
 *
 * Each carries the sentence the console shows next to the checkbox. They are worth writing
 * carefully: a developer ticking boxes is deciding what a stranger will be made to do, and
 * the cost of each one is not obvious from its name.
 */
import { keccak256, toHex } from 'viem'

export const CREDENTIALS = [
  {
    id: 'google',
    label: 'Google',
    note: 'Fastest way in. Works today.',
  },
  {
    id: 'email',
    label: 'Email code',
    note: 'Two codes from two senders. No provider needed, but weaker — it cannot recover an account.',
  },
  {
    id: 'passkey',
    label: 'Passkey',
    note: 'Second factor, and the thing that keeps working when a provider does not. Recommended.',
  },
  {
    id: 'world.age',
    label: 'Age, by passport',
    note: 'For when the law asks, not because it is interesting. Checked once at the door.',
  },
  {
    id: 'world.selfie',
    label: 'A live person',
    note: 'Stops scripts. Ask for it at the moment that matters, not at the door.',
  },
]

export const COMING_SOON = ['Apple', 'Meta', 'GitHub']

export function kindHash(id) {
  return keccak256(toHex(id))
}

export function idFor(hash) {
  return CREDENTIALS.find((c) => kindHash(c.id) === hash)?.id ?? hash
}
