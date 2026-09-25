import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commit, newCode } from '../src/commitment.js'

const nonce = '0x' + '11'.repeat(32)

test('the same inputs give the same commitment', () => {
  assert.equal(commit({ code: '123456', email: 'a@b.c', nonce }), commit({ code: '123456', email: 'a@b.c', nonce }))
})

test('capitalisation in an address does not change the person', () => {
  assert.equal(
    commit({ code: '123456', email: 'Alice@Example.com', nonce }),
    commit({ code: '123456', email: 'alice@example.com', nonce }),
  )
})

test('a commitment is bound to its attempt', () => {
  assert.notEqual(
    commit({ code: '123456', email: 'a@b.c', nonce }),
    commit({ code: '123456', email: 'a@b.c', nonce: '0x' + '22'.repeat(32) }),
  )
})

test('codes are six digits', () => {
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^\d{6}$/)
})
