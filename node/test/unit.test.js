import { test } from 'node:test'
import assert from 'node:assert/strict'
import { credentialHash, ISSUERS } from '../src/credential.js'
import { linkDigest } from '../src/share.js'
import { commitment } from '../src/otp.js'
import { nonceFor } from '../src/verify.js'

const SALT = '0x' + '00'.repeat(32)

test('a credential hash is stable for the same person', () => {
  const a = credentialHash({ iss: ISSUERS.google, sub: '12345', salt: SALT })
  const b = credentialHash({ iss: ISSUERS.google, sub: '12345', salt: SALT })
  assert.equal(a, b)
})

test('the issuer keeps two providers from colliding', () => {
  const google = credentialHash({ iss: ISSUERS.google, sub: '12345', salt: SALT })
  const world = credentialHash({ iss: ISSUERS.world, sub: '12345', salt: SALT })
  assert.notEqual(google, world)
})

test('the link digest matches what the registry computes', () => {
  // Cross-checked against `cast keccak $(cast abi-encode ...)` for the same inputs.
  const digest = linkDigest({
    chainId: 11155111,
    identityRegistry: '0x1111111111111111111111111111111111111111',
    credentialHash: '0x' + '22'.repeat(32),
    identity: '0x3333333333333333333333333333333333333333',
  })
  assert.equal(digest, '0x9b7c4e90e2ebbfbcd87e8d7c9bf8450d5fae784a7beb7298f1948ede2a7de1de')
})

test('a digest is bound to its chain and its registry', () => {
  const base = {
    identityRegistry: '0x1111111111111111111111111111111111111111',
    credentialHash: '0x' + '22'.repeat(32),
    identity: '0x3333333333333333333333333333333333333333',
  }
  assert.notEqual(
    linkDigest({ ...base, chainId: 1 }),
    linkDigest({ ...base, chainId: 11155111 }),
    'the same attestation must not be replayable on another chain',
  )
  assert.notEqual(
    linkDigest({ ...base, chainId: 1 }),
    linkDigest({ ...base, chainId: 1, identityRegistry: '0x' + '44'.repeat(20) }),
    'nor at another deployment',
  )
})

test('the nonce commits to the session key', () => {
  const key = '0x' + 'ab'.repeat(33)
  assert.equal(nonceFor(key), nonceFor(key))
  assert.notEqual(nonceFor(key), nonceFor('0x' + 'cd'.repeat(33)))
})

test('an email commitment is case-insensitive in the address', () => {
  const nonce = '0x' + '11'.repeat(32)
  assert.equal(
    commitment({ code: '123456', email: 'Alice@Example.com', nonce }),
    commitment({ code: '123456', email: 'alice@example.com', nonce }),
  )
})

test('a different code gives a different commitment', () => {
  const nonce = '0x' + '11'.repeat(32)
  assert.notEqual(
    commitment({ code: '123456', email: 'a@b.c', nonce }),
    commitment({ code: '654321', email: 'a@b.c', nonce }),
  )
})
