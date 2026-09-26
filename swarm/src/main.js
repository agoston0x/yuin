/**
 * Sign-up, served from Swarm.
 *
 * The same flow as the hosted page and deliberately the same code, built into one file
 * with nothing fetched at runtime. That matters more here than anywhere else in the
 * project: this is the page that handles the password, and the argument for it is that
 * nobody operates it. A page that pulled a script from a server would hand that server
 * the ability to change what the password does.
 *
 * So: one file, one hash, no network except the two senders and a public RPC.
 */
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { deriveIdentity } from './identity.js'
import * as session from './owner.js'
import * as senders from './senders.js'
import * as passkey from './passkey.js'

const REGISTRY = process.env.NEXT_PUBLIC_EMAIL_IDENTITY_REGISTRY
const VERIFIER = process.env.NEXT_PUBLIC_P256_VERIFIER
const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'

const registryAbi = [
  { type: 'function', name: 'addressFor', stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'accountOf', stateMutability: 'view',
    inputs: [{ type: 'bytes32' }], outputs: [{ type: 'address' }] },
]

const accountAbi = [
  { type: 'function', name: 'addPasskey', stateMutability: 'nonpayable',
    inputs: [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setP256Verifier', stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }], outputs: [] },
]

const client = createPublicClient({ chain: sepolia, transport: http(RPC) })
const el = (id) => document.getElementById(id)
const show = (id) => { for (const s of document.querySelectorAll('.step')) s.hidden = s.id !== id }
const say = (text, kind = '') => { el('status').textContent = text; el('status').dataset.kind = kind }

let state = {}

el('start').addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    const email = el('email').value.trim()
    const password = el('password').value
    if (password.length < 10) throw new Error('use at least ten characters — this is the key, not a login')

    say('Stretching your password. This is meant to be slow.')
    const derived = await deriveIdentity({ email, password })
    const owner = session.loadOrCreate()

    say('Checking whether this account already exists…')
    const existing = await client.readContract({
      address: REGISTRY, abi: registryAbi, functionName: 'accountOf', args: [derived.identityHash],
    })

    if (existing !== '0x0000000000000000000000000000000000000000') {
      el('account').textContent = existing
      say('')
      show('exists')
      return
    }

    const predicted = await client.readContract({
      address: REGISTRY, abi: registryAbi, functionName: 'addressFor',
      args: [derived.identityHash, owner.address],
    })

    say('Asking both senders for a code…')
    await senders.requestCodes(email)

    state = { ...derived, email, owner, predicted }
    el('predicted').textContent = predicted
    say('')
    show('codes')
  } catch (e) {
    say(e.message, 'bad')
  }
})

el('finish').addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    const nonce = Date.now()
    const expiry = Math.floor(Date.now() / 1000) + 600

    say('Collecting a signature from each sender…')
    const signatures = await senders.collectSignatures({
      email: state.email,
      codes: [el('code1').value.trim(), el('code2').value.trim()],
      identityHash: state.identityHash,
      firstOwner: state.owner.address,
      nonce,
      expiry,
    })

    say('Creating the account on chain…')
    const result = await senders.relay({
      identityHash: state.identityHash,
      firstOwner: state.owner.address,
      nonce, expiry, signatures,
    })

    state.account = result.account
    el('made').textContent = result.account
    say('')
    show('passkey')
  } catch (e) {
    say(e.message, 'bad')
  }
})

el('addkey').addEventListener('click', async () => {
  try {
    say('Waiting for your device…')
    const created = await passkey.create({ account: state.account, label: state.email })

    say('Getting gas to register it…')
    await fetch(new URL('/drip', senders.endpoints()[0]), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: state.owner.address }),
    }).catch(() => {})

    const wallet = (await import('viem')).createWalletClient({
      account: privateKeyToAccount(state.owner.privateKey),
      chain: sepolia,
      transport: http(RPC),
    })

    say('Registering the passkey on chain…')
    if (VERIFIER) {
      const one = await wallet.writeContract({
        address: state.account, abi: accountAbi, functionName: 'setP256Verifier', args: [VERIFIER],
      })
      await client.waitForTransactionReceipt({ hash: one })
    }
    const two = await wallet.writeContract({
      address: state.account, abi: accountAbi, functionName: 'addPasskey',
      args: [created.credentialId, BigInt(created.x), BigInt(created.y)],
    })
    await client.waitForTransactionReceipt({ hash: two })

    passkey.markRegistered()
    el('done-account').textContent = state.account
    say('')
    show('done')
  } catch (e) {
    say(e.shortMessage ?? e.message, 'bad')
  }
})

show('start-step')
