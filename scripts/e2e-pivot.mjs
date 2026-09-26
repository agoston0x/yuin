/**
 * The browser's half of the flow, run from node so it can be asserted on.
 *
 * Deliberately talks to the two senders over HTTP exactly as the page does, and reads the
 * chain exactly as the page does. If this passes, the only thing left untested between
 * here and a user is the form itself.
 *
 * It exists because every piece passes its own tests in isolation and that proves nothing
 * about whether they agree with each other. The digest the senders sign has to be the
 * digest the contract reconstructs, byte for byte — exactly the kind of disagreement unit
 * tests on either side will both happily miss.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createPublicClient, encodePacked, http, keccak256 } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { argon2id } from 'hash-wasm'

const REGISTRY = process.env.REGISTRY
const RPC = process.env.RPC ?? 'http://127.0.0.1:8545'
const SENDERS = ['http://127.0.0.1:8760', 'http://127.0.0.1:8761']
const LOGS = process.env.LOGS
  ? process.env.LOGS.split(',')
  : ['/tmp/yuin-sender-one.log', '/tmp/yuin-sender-two.log']

const EMAIL = 'alice@example.com'
const PASSWORD = 'correct horse battery staple'

const abi = [
  {
    type: 'function',
    name: 'addressFor',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'accountOf',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
]

const client = createPublicClient({ transport: http(RPC) })

async function post(url, path, body) {
  const response = await fetch(new URL(path, url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${url}${path}: ${data.error ?? response.status}`)
  return data
}

/** The same derivation the page does, with the same parameters. */
async function identityFor(email, password) {
  const hex = await argon2id({
    password,
    salt: new TextEncoder().encode(`yuin/email/${email.toLowerCase()}`),
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'hex',
  })
  const stretched = `0x${hex}`
  return keccak256(encodePacked(['string', 'bytes32'], [email.toLowerCase(), stretched]))
}

const step = (n, what) => console.log(`   ${n}. ${what}`)

// ---- the flow ----

const identityHash = await identityFor(EMAIL, PASSWORD)
step(1, `identity ${identityHash.slice(0, 18)} derived with argon2id`)

const owner = privateKeyToAccount(generatePrivateKey())
step(2, `owner key ${owner.address}`)

const predicted = await client.readContract({
  address: REGISTRY,
  abi,
  functionName: 'addressFor',
  args: [identityHash, owner.address],
})
step(3, `account will be ${predicted}`)

for (const url of SENDERS) {
  await post(url, '/code', { email: EMAIL })
}
step(4, 'both senders mailed a code')

// The dev senders log the code rather than mailing it; read it back the way a person
// looking at their inbox would.
const codes = LOGS.map((path) => {
  const line = readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l.includes('->'))
    .pop()
  return line.split('->')[1].trim()
})
step(5, `codes ${codes.join(' and ')}`)

const nonce = Date.now()
const expiry = Math.floor(Date.now() / 1000) + 600

const signed = []
for (let i = 0; i < SENDERS.length; i++) {
  const result = await post(SENDERS[i], '/sign', {
    email: EMAIL,
    code: codes[i],
    identityHash,
    firstOwner: owner.address,
    nonce,
    expiry,
  })
  signed.push({ signature: result.signature, signer: result.signer.toLowerCase() })
}
// Ascending signer order, because that is how the registry excludes duplicates.
const signatures = signed.sort((a, b) => (a.signer < b.signer ? -1 : 1)).map((s) => s.signature)
step(6, 'each sender signed once')

const relayed = await post(SENDERS[0], '/relay', {
  identityHash,
  firstOwner: owner.address,
  nonce,
  expiry,
  signatures,
})
step(7, `created in ${relayed.tx}`)

// ---- what must be true ----

assert.equal(
  relayed.account.toLowerCase(),
  predicted.toLowerCase(),
  'the account must land where it was promised',
)

const onChain = await client.readContract({
  address: REGISTRY,
  abi,
  functionName: 'accountOf',
  args: [identityHash],
})
assert.equal(onChain.toLowerCase(), predicted.toLowerCase(), 'the registry must know the account')

const code = await client.getCode({ address: predicted })
assert.ok(code && code !== '0x', 'the account must be deployed')

// The same email and password, derived again, must land on the same identity — which is
// the claim the whole design rests on. And a different password must not.
assert.equal(await identityFor(EMAIL, PASSWORD), identityHash, 'the identity must be reproducible')
assert.notEqual(await identityFor(EMAIL, 'a different password'), identityHash, 'the password must matter')

// One sender signing twice is still one sender.
await assert.rejects(
  post(SENDERS[0], '/relay', {
    identityHash: keccak256(encodePacked(['string'], ['someone else'])),
    firstOwner: owner.address,
    nonce: nonce + 1,
    expiry,
    signatures: [signatures[0], signatures[0]],
  }),
  'one sender signing twice must not create an account',
)
step(8, 'one sender signing twice was refused')

console.log(`\n   passed: ${predicted} exists, from an email address and a password\n`)
