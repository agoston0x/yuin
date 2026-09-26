/**
 * The codes this sender has mailed, and nothing else.
 *
 * Held in memory with a short life, because there is nothing here worth keeping: a
 * restart forgets them, the user asks again, and no database exists to be stolen. A code
 * is worth exactly one attempt — right or wrong, it is spent — so guessing costs a fresh
 * email every time.
 */
import { randomInt } from 'node:crypto'

const TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS_PER_EMAIL = 5

const issued = new Map() // email => { code, expiresAt }
const attempts = new Map() // email => { count, resetAt }

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function issue(email) {
  const key = email.toLowerCase()
  const code = newCode()
  issued.set(key, { code, expiresAt: Date.now() + TTL_MS })
  return code
}

/** True once, for the right code, before it expires. */
export function redeem(email, code) {
  const key = email.toLowerCase()

  const record = issued.get(key)
  if (!record) return false

  issued.delete(key)
  if (Date.now() > record.expiresAt) return false
  return record.code === code
}

/**
 * A crude ceiling on how often one address can be mailed. Not a defence against a
 * determined attacker — it is a defence against this service being used to send someone
 * else a hundred emails.
 */
export function withinRateLimit(email) {
  const key = email.toLowerCase()
  const now = Date.now()
  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (record.count >= MAX_ATTEMPTS_PER_EMAIL) return false
  record.count++
  return true
}
