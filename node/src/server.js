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

  /** Issue one of the two email codes. The other sender is not this node's business. */
  app.post('/otp', async (req, res) => {
    const { email, nonce } = req.body ?? {}
    if (!email || !nonce) return res.status(400).json({ error: 'email and nonce are required' })
    const { code, commitment } = otp.issue({ email, nonce })
    // TODO: hand `code` to the mail service; it is returned here only until that exists.
    res.json({ commitment, code: process.env.NODE_ENV === 'production' ? undefined : code })
  })

  app.post('/otp/check', async (req, res) => {
    const { email, nonce, code } = req.body ?? {}
    res.json({ ok: otp.check({ email, nonce, code }) })
  })

  return app
}
