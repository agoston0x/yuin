/**
 * One half of an email one-time code.
 *
 * A user signing up with email gets two codes from two senders who do not know each
 * other: this one, and the app's own. Each publishes only the hash of what it sent, so
 * neither can sign anyone in alone and compromising one mailbox gets an attacker exactly
 * half of what they need.
 *
 * The password matters more than either code. The identity key folds in a stretch of it,
 * so both senders colluding — without the password — land on a different, empty identity
 * and learn nothing. That is also why this path may create an identity and may never
 * recover one: a code arriving in a mailbox proves the mailbox, not the person.
 */
import express from 'express'
import { commit, newCode } from './commitment.js'
import { codeEmail } from './templates.js'
import { send } from './send.js'

const TTL_MS = 10 * 60 * 1000
const issued = new Map() // `${email}:${nonce}` => { commitment, expiresAt }
const LABEL = process.env.SENDER_LABEL ?? 'Manju'

const app = express()
app.use(express.json({ limit: '16kb' }))
app.use((_req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', 'content-type')
  next()
})
app.options('*', (_req, res) => res.sendStatus(204))

app.get('/health', (_req, res) => res.json({ sender: LABEL, pending: issued.size }))

/** Returns the commitment. The code goes to the mailbox and nowhere else. */
app.post('/code', async (req, res) => {
  try {
    const { email, nonce, appName } = req.body ?? {}
    if (!email || !nonce) return res.status(400).json({ error: 'email and nonce are required' })

    const code = newCode()
    const commitment = commit({ code, email, nonce })
    issued.set(key(email, nonce), { commitment, expiresAt: Date.now() + TTL_MS })

    await send({ to: email, ...codeEmail({ code, appName: appName ?? 'an app', senderLabel: LABEL }) })
    res.json({ commitment, sender: LABEL })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** A code is worth exactly one attempt, right or wrong. */
app.post('/check', (req, res) => {
  const { email, nonce, code } = req.body ?? {}
  const record = issued.get(key(email, nonce))
  issued.delete(key(email, nonce))

  if (!record || Date.now() > record.expiresAt) return res.json({ ok: false })
  res.json({ ok: record.commitment === commit({ code, email, nonce }) })
})

function key(email, nonce) {
  return `${email.toLowerCase()}:${nonce}`
}

const port = Number(process.env.PORT ?? 8710)
app.listen(port, () => console.log(`${LABEL} mail sender on :${port}`))
