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
import { accountFor, submit } from './relay.js'
import { identityFor, verifyIdToken } from './google.js'

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

/**
 * Sign for an account named by a Google token.
 *
 * Weaker than the email path and deliberately not the default: there is no password here,
 * so two colluding senders could create an account for someone who never asked. See
 * src/google.js for what removes that and why it has not been done yet.
 */
app.post('/sign-google', async (req, res) => {
  try {
    const { token, firstOwner, nonce, expiry } = req.body ?? {}
    if (!token || !firstOwner || nonce === undefined || !expiry) {
      return res.status(400).json({ error: 'token, firstOwner, nonce and expiry are required' })
    }
    if (!config.googleClientId) {
      return res.status(501).json({ error: 'this sender has no google client configured' })
    }

    const claims = await verifyIdToken({ token, audience: config.googleClientId, firstOwner })
    const identityHash = identityFor(claims.sub)

    const digest = createDigest({
      chainId: config.chainId,
      registry: config.registry,
      identityHash,
      firstOwner,
      nonce,
      expiry,
    })

    res.json({
      identityHash,
      signature: await signDigest({ digest, privateKey: config.privateKey }),
      signer: account.address,
      sender: config.label,
      // Said in the response, not only in a comment: a caller should be able to tell that
      // this path rests on us rather than on a proof.
      trustModel: 'sender-attested',
    })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
})

/**
 * Broadcast a transaction the browser cannot pay for.
 *
 * Every field here is already inside the digest both senders signed, so this service
 * cannot change what happens — only whether it happens. `createAccount` is
 * permissionless, so anyone holding ether can send the same transaction instead.
 */
app.post('/relay', async (req, res) => {
  try {
    const { identityHash, firstOwner, nonce, expiry, signatures } = req.body ?? {}
    if (!identityHash || !firstOwner || nonce === undefined || !expiry || !Array.isArray(signatures)) {
      return res.status(400).json({ error: 'identityHash, firstOwner, nonce, expiry and signatures are required' })
    }
    if (signatures.length !== 2) return res.status(400).json({ error: 'two signatures are required' })

    const existing = await accountFor(identityHash)
    if (existing && existing !== '0x0000000000000000000000000000000000000000') {
      return res.json({ account: existing, created: false })
    }

    const result = await submit({ identityHash, firstOwner, nonce, expiry, signatures })
    res.json({ account: result.account, tx: result.hash, created: true })
  } catch (error) {
    // Whatever the chain said, rather than a guess at what it meant.
    res.status(400).json({ error: error.shortMessage ?? error.message })
  }
})

app.listen(config.port, () => {
  console.log(`${config.label} sender on :${config.port} signing as ${account.address}`)
})
