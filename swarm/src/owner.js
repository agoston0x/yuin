/**
 * The first owner of the account.
 *
 * A key made here and kept here. It is what signs for the account until a passkey is
 * added, and it is the one thing in this flow that is genuinely secret and genuinely
 * fragile — losing it before adding a second owner means losing the account, which is
 * why the page refuses to consider sign-up finished until a passkey exists.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const KEY = 'yuin.owner'

export function loadOrCreate() {
  const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  if (existing) {
    const privateKey = JSON.parse(existing).privateKey
    return { privateKey, address: privateKeyToAccount(privateKey).address }
  }

  const privateKey = generatePrivateKey()
  const owner = { privateKey, address: privateKeyToAccount(privateKey).address }
  localStorage.setItem(KEY, JSON.stringify(owner))
  return owner
}

/**
 * Record which account this key controls.
 *
 * The key alone is not enough to do anything with: an owner key is meaningless without
 * the account it owns, and the account page has no way to rediscover it. So the moment
 * the account exists, the pair is stored together.
 */
export function remember(account) {
  const existing = current()
  if (!existing) throw new Error('there is no key in this browser to attach an account to')
  localStorage.setItem(KEY, JSON.stringify({ ...existing, account }))
}

export function current() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  return raw ? JSON.parse(raw) : null
}

export function forget() {
  localStorage.removeItem(KEY)
}
