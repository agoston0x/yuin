/**
 * One of the two senders.
 *
 * Both run this same code with different keys, and an account needs a signature from
 * each. That is not because two mailboxes are safer than one — they are the same mailbox
 * — but because it takes two independent operators to agree, and neither of them holds
 * the password that actually binds the identity.
 *
 * This service never sees a password, never sees an identity hash it could reverse, and
 * keeps nothing after a code is spent. What it can do is refuse, and what it cannot do is
 * create an account alone.
 */
import express from 'express'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.js'
import { createDigest, signDigest } from './digest.js'
import { issue, redeem, withinRateLimit } from './codes.js'
import { send } from './mail.js'

const account = privateKeyToAccount(config.privateKey)

const app = express()
app.use(express.json({ limit: '16kb' }))
app.use((_req, res, next) => {
  // The page that calls this is static and served from anywhere; nothing here is
  // authenticated by origin, so nothing is gained by pretending otherwise.
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', 'content-type')
  next()
})
app.options('*', (_req, res) => res.sendStatus(204))

app.get('/health', (_req, res) =>
  res.json({
    label: config.label,
    signer: account.address,
    chainId: config.chainId,
    registry: config.registry,
  }),
)

/** Mail a code. The code goes to the mailbox and nowhere else — not even back here. */
app.post('/code', async (req, res) => {
  try {
    const { email } = req.body ?? {}
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'an email address is required' })
    if (!withinRateLimit(email)) return res.status(429).json({ error: 'too many codes for that address' })

    await send({ to: email, code: issue(email) })
    res.json({ sent: true, sender: config.label, signer: account.address })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * Trade a correct code for a signature.
 *
 * The signature covers the identity hash, the first owner, a nonce and an expiry — all
 * chosen by the browser, none of which this service can alter without invalidating what
 * it signs. It is an assertion about one thing only: someone reading that mailbox asked
 * for this account, a moment ago.
 */
app.post('/sign', async (req, res) => {
  try {
    const { email, code, identityHash, firstOwner, nonce, expiry } = req.body ?? {}
    if (!email || !code || !identityHash || !firstOwner || nonce === undefined || !expiry) {
      return res.status(400).json({ error: 'email, code, identityHash, firstOwner, nonce and expiry are required' })
    }

    if (!redeem(email, code)) return res.status(401).json({ error: 'that code is wrong or has expired' })

    const now = Math.floor(Date.now() / 1000)
    if (Number(expiry) <= now) return res.status(400).json({ error: 'that expiry is already in the past' })
    // A signature good for a week is a signature someone can sit on. Ten minutes is
    // plenty for a person who is already looking at their inbox.
    if (Number(expiry) > now + 900) return res.status(400).json({ error: 'expiry too far ahead' })

    const digest = createDigest({
      chainId: config.chainId,
      registry: config.registry,
      identityHash,
      firstOwner,
      nonce,
      expiry,
    })

    res.json({
      signature: await signDigest({ digest, privateKey: config.privateKey }),
      signer: account.address,
      sender: config.label,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(config.port, () => {
  console.log(`${config.label} sender on :${config.port} signing as ${account.address}`)
})
