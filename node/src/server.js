/**
 * The gateway a browser posts to.
 *
 * Thin on purpose. Accept a request, verify it, put a share on the wire, answer with what
 * the page needs to keep going. Nothing is stored between requests except the codes this
 * node has mailed, and those expire on their own.
 */
import express from 'express'
import { keccak256, toHex } from 'viem'
import { config } from './config.js'
import { verifyIdToken } from './verify.js'
import { credentialHash, ISSUERS } from './credential.js'
import { linkDigest, signShare } from './share.js'
import { collect } from './commander.js'
import * as chain from './chain.js'
import * as gsoc from './gsoc.js'
import * as otp from './otp.js'

export function createServer() {
  const app = express()
  app.use(express.json({ limit: '64kb' }))
  app.use((_req, res, next) => {
    // Any origin may sign in; nothing here is authenticated by origin.
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Headers', 'content-type')
    next()
  })
  app.options('*', (_req, res) => res.sendStatus(204))

  app.get('/health', async (_req, res) => {
    const swarm = await gsoc.health().catch((error) => ({ reachable: false, error: error.message }))
    res.json({
      operator: chain.account.address,
      gateway: config.gateway,
      chainId: chain.chainId,
      swarm,
    })
  })

  /**
   * Sign in with a provider token.
   *
   * The account is deployed and the credential linked only if this is the first time we
   * have seen it. A returning user needs no transaction at all — the answer is already on
   * chain, and telling them so is faster than pretending to work.
   */
  app.post('/login', async (req, res) => {
    try {
      const { token, appId, sessionPublicKey, sessionAddress } = req.body
      if (!token || !sessionPublicKey || !sessionAddress) {
        return res.status(400).json({ error: 'token, sessionPublicKey and sessionAddress are required' })
      }

      const app = appId ? await chain.appRecord(appId) : null
      if (appId && !app?.exists) return res.status(404).json({ error: 'unknown app' })

      const claims = await verifyIdToken({
        token,
        audience: app ? app.aud : undefined,
        sessionPublicKey,
      })

      const hash = credentialHash({ iss: claims.iss, sub: claims.sub, salt: config.salt })

      const existing = await chain.identityOf(hash)
      if (existing !== '0x0000000000000000000000000000000000000000') {
        return res.json({ identity: existing, created: false })
      }

      const identity = appId
        ? await chain.appAddress(hash, appId, sessionAddress)
        : await chain.personalAddress(hash, sessionAddress)

      const digest = linkDigest({
        chainId: chain.chainId,
        identityRegistry: config.contracts.identityRegistry,
        credentialHash: hash,
        identity,
      })

      const signatures = await collect({
        digest,
        threshold: Number(await chain.threshold()),
        ownShare: {
          signer: chain.account.address,
          signature: await signShare({ digest, privateKey: config.privateKey }),
        },
      })

      const result = await chain.deployAndLink({
        credentialHash: hash,
        appId: appId ?? null,
        firstOwner: sessionAddress,
        signatures,
      })

      res.json({ identity: result.identity, created: true, tx: result.linkHash })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  /**
   * Sign in with two email codes and a password.
   *
   * Both codes are checked — one issued by this node, one by a sender it does not control
   * — and neither is sufficient alone. The credential key arrives already stretched from
   * the password in the browser, so no node ever sees the password and two colluding
   * senders without it land on a different, empty identity.
   *
   * This path may create an identity. It may not recover one: a code arriving in a mailbox
   * proves the mailbox, not the person.
   */
  app.post('/login/email', async (req, res) => {
    try {
      const { email, nonce, codes, credentialKey, sessionAddress, appId } = req.body ?? {}
      if (!email || !nonce || !Array.isArray(codes) || codes.length < 2 || !credentialKey || !sessionAddress) {
        return res.status(400).json({ error: 'email, nonce, two codes, credentialKey and sessionAddress are required' })
      }

      const mine = otp.check({ email, nonce, code: codes[0] })
      const theirs = await checkWithSecondSender({ email, nonce, code: codes[1] })
      if (!mine || !theirs) return res.status(400).json({ error: 'both codes have to be right' })

      const hash = credentialHash({ iss: ISSUERS.email, sub: credentialKey, salt: config.salt })

      const existing = await chain.identityOf(hash)
      if (existing !== '0x0000000000000000000000000000000000000000') {
        return res.json({ identity: existing, created: false })
      }

      const identity = appId
        ? await chain.appAddress(hash, appId, sessionAddress)
        : await chain.personalAddress(hash, sessionAddress)

      const digest = linkDigest({
        chainId: chain.chainId,
        identityRegistry: config.contracts.identityRegistry,
        credentialHash: hash,
        identity,
      })

      const signatures = await collect({
        digest,
        threshold: Number(await chain.threshold()),
        ownShare: {
          signer: chain.account.address,
          signature: await signShare({ digest, privateKey: config.privateKey }),
        },
      })

      const result = await chain.deployAndLink({
        credentialHash: hash,
        appId: appId ?? null,
        firstOwner: sessionAddress,
        signatures,
      })

      res.json({ identity: result.identity, created: true, tx: result.linkHash })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  /** What an app demands for an action — the same answer its ENS name gives. */
  app.get('/policy/:appId/:action', async (req, res) => {
    try {
      const action =
        req.params.action === 'login' ? '0x' + '00'.repeat(32) : keccak256(toHex(req.params.action))
      res.json({ kinds: await chain.policyFor(req.params.appId, action) })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  /**
   * Issue one of the two email codes. The other sender is not this node's business, and
   * the code itself never comes back over this connection — it goes to the mailbox, which
   * is the only reason it is worth anything.
   */
  app.post('/otp', async (req, res) => {
    try {
      const { email, nonce, appName } = req.body ?? {}
      if (!email || !nonce) return res.status(400).json({ error: 'email and nonce are required' })

      const { code, commitment } = otp.issue({ email, nonce })
      await mail({ email, code, appName })
      res.json({ commitment })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/otp/check', async (req, res) => {
    const { email, nonce, code } = req.body ?? {}
    res.json({ ok: otp.check({ email, nonce, code }) })
  })

  return app
}

/**
 * The second code comes from a sender this node does not operate. If that sender is not
 * configured, this path is unavailable rather than quietly reduced to one code — half a
 * two-sender scheme is worse than none, because it looks like the real thing.
 */
async function checkWithSecondSender({ email, nonce, code }) {
  const url = process.env.SECOND_SENDER_URL
  if (!url) throw new Error('no second sender is configured, so email sign-in is off')

  const response = await fetch(new URL('/check', url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, nonce, code }),
  })
  if (!response.ok) return false
  const data = await response.json()
  return data.ok === true
}

/** Hand the code to the mail service. In development it is logged there, not sent. */
async function mail({ email, code, appName }) {
  const url = process.env.MAIL_URL
  if (!url) {
    console.log(`[otp] ${email} -> ${code}`)
    return
  }
  const response = await fetch(new URL('/deliver', url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code, appName }),
  })
  if (!response.ok) throw new Error('the mail service refused to send the code')
}
