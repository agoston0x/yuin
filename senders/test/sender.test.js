import { test } from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'
import { recoverAddress } from 'viem'
import { createDigest, signDigest } from '../src/digest.js'
import { issue, redeem, withinRateLimit } from '../src/codes.js'

const BASE = {
  chainId: 11155111,
  registry: '0x1111111111111111111111111111111111111111',
  identityHash: '0x' + '22'.repeat(32),
  firstOwner: '0x3333333333333333333333333333333333333333',
  nonce: 7,
  expiry: 1790000000,
}

// Cross-checked against `cast keccak $(cast abi-encode ...)` for the same inputs, so a
// change here that drifts from the contract fails loudly rather than at signing time.
test('the digest matches what the registry computes', () => {
  assert.equal(createDigest(BASE), '0xff68a4f6961ac31650b8eb6aee0268f24db4f69680e9141e644ec2185fe914ac')
})

test('a digest is bound to its chain, its registry and its owner', () => {
  assert.notEqual(createDigest(BASE), createDigest({ ...BASE, chainId: 1 }))
  assert.notEqual(createDigest(BASE), createDigest({ ...BASE, registry: '0x' + '44'.repeat(20) }))
  assert.notEqual(createDigest(BASE), createDigest({ ...BASE, firstOwner: '0x' + '55'.repeat(20) }))
  assert.notEqual(createDigest(BASE), createDigest({ ...BASE, nonce: 8 }))
  assert.notEqual(createDigest(BASE), createDigest({ ...BASE, expiry: 1790000001 }))
})

test('a signature recovers to the sender that made it', async () => {
  const privateKey = '0x' + '01'.repeat(32)
  const signature = await signDigest({ digest: createDigest(BASE), privateKey })
  const recovered = await recoverAddress({ hash: createDigest(BASE), signature })
  assert.equal(recovered.toLowerCase(), privateKeyToAccount(privateKey).address.toLowerCase())
})

test('two senders produce two different signatures over one digest', async () => {
  const digest = createDigest(BASE)
  const a = await signDigest({ digest, privateKey: '0x' + '01'.repeat(32) })
  const b = await signDigest({ digest, privateKey: '0x' + '02'.repeat(32) })
  assert.notEqual(a, b)

  const signers = await Promise.all([a, b].map((signature) => recoverAddress({ hash: digest, signature })))
  assert.notEqual(signers[0], signers[1], 'the registry rejects two signatures from one signer')
})

test('a code works once', () => {
  const code = issue('alice@example.com')
  assert.equal(redeem('alice@example.com', code), true)
  assert.equal(redeem('alice@example.com', code), false, 'a spent code must not work again')
})

test('a wrong code is spent anyway', () => {
  const code = issue('bob@example.com')
  assert.equal(redeem('bob@example.com', '000000'), false)
  assert.equal(redeem('bob@example.com', code), false, 'guessing costs a fresh email')
})

test('an address is the same address in any capitalisation', () => {
  const code = issue('Carol@Example.com')
  assert.equal(redeem('carol@example.com', code), true)
})

test('one address cannot be mailed endlessly', () => {
  const email = 'flood@example.com'
  const allowed = []
  for (let i = 0; i < 8; i++) allowed.push(withinRateLimit(email))
  assert.equal(allowed.filter(Boolean).length, 5)
})
