/**
 * What a developer can ask of their users, in the order a person would think of them.
 *
 * Each carries the sentence shown beside the checkbox, and those sentences are worth
 * writing carefully: someone ticking a box here is deciding what a stranger will be made
 * to do, and the cost of each one is not obvious from its name.
 */
import { keccak256, toHex } from 'viem'

export const METHODS = [
  {
    id: 'email',
    label: 'Email code',
    note: 'Two codes from two independent senders, plus a password we never see. Private: we cannot map the account back to the person.',
  },
  {
    id: 'google',
    label: 'Google',
    note: 'One click, and faster. Rests on Google and on us attesting the token — convenient rather than private.',
  },
  {
    id: 'passkey',
    label: 'Passkey',
    note: 'Not a sign-in method on its own. It is what makes the account survive a lost device, so ask for it.',
  },
  {
    id: 'world.age',
    label: 'Age, by passport',
    note: 'For when the law asks. Establishes "over 18" and nothing else. Coming soon.',
    soon: true,
  },
  {
    id: 'world.selfie',
    label: 'A live person',
    note: 'Stops scripts. Best asked at the action that matters, not at the door. Coming soon.',
    soon: true,
  },
]

export const LOGIN_ACTION = '0x' + '00'.repeat(32)

export function kindHash(id) {
  return keccak256(toHex(id))
}

export function idFor(hash) {
  return METHODS.find((m) => kindHash(m.id) === hash)?.id ?? hash
}

export function appIdFor(label) {
  return keccak256(toHex(label.trim().toLowerCase()))
}
