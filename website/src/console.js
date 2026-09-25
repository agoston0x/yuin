/**
 * The developer console.
 *
 * This page is the argument. An app's authentication is a form: tick what people must
 * present to get in, name the actions that need more, and save. The result is a
 * transaction to AppRegistry, which means the rules are public, enforced by every node,
 * and readable from the app's ENS name by anyone — including the users who will be held
 * to them.
 *
 * Nothing is deployed when a policy changes. The next call reads the new rules. That is
 * the difference between configuration and code, and it is the whole pitch.
 */
import { keccak256, parseEther, toHex, zeroHash } from 'viem'
import { publicClient, wallet, waitFor } from './chain.js'
import { config } from './config.js'
import { appRegistryAbi, resolverAbi } from './abi.js'
import { CREDENTIALS, COMING_SOON, idFor, kindHash } from './credentials.js'

const el = (id) => document.getElementById(id)
const appIdFor = (label) => keccak256(toHex(label))

let connected = null
let label = ''

async function connect() {
  connected = await wallet()
  el('wallet').textContent = connected.account
  el('wallet').hidden = false
  el('connect').hidden = true
  el('panel').hidden = false
}

async function load() {
  label = el('label').value.trim().toLowerCase()
  if (!label) return status('Give the app a name first.')

  const appId = appIdFor(label)
  const registered = await publicClient.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'isRegistered',
    args: [appId],
  })

  el('ens').textContent = `${label}.app.${config.ensRoot}`

  if (!registered) {
    status('Not registered yet. Fill these in and stake to claim the name.')
    el('register').hidden = false
    el('policy').hidden = true
    return
  }

  const app = await publicClient.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'appOf',
    args: [appId],
  })

  el('aud').value = app.aud
  el('gateway').value = app.gateway
  el('owner').textContent = app.owner
  el('register').hidden = true
  el('policy').hidden = false

  await loadPolicy(appId)
  status(`Registered. Anyone can read these rules at ${label}.app.${config.ensRoot}.`)
}

async function loadPolicy(appId) {
  const login = await publicClient.readContract({
    address: config.contracts.appRegistry,
    abi: appRegistryAbi,
    functionName: 'policyFor',
    args: [appId, zeroHash],
  })
  const held = login.map(idFor)

  for (const credential of CREDENTIALS) {
    const box = el(`login-${credential.id}`)
    if (box) box.checked = held.includes(credential.id)
  }

  await refreshActions(appId)
}

/** Actions are named by the developer; the chain holds them by hash, so we keep the names here. */
function knownActions() {
  return JSON.parse(localStorage.getItem(`manju.actions.${label}`) ?? '[]')
}

function rememberAction(action) {
  const actions = new Set(knownActions())
  actions.add(action)
  localStorage.setItem(`manju.actions.${label}`, JSON.stringify([...actions]))
}

async function refreshActions(appId) {
  const actions = knownActions()
  const rows = await Promise.all(
    actions.map(async (action) => {
      const kinds = await publicClient.readContract({
        address: config.contracts.appRegistry,
        abi: appRegistryAbi,
        functionName: 'policyFor',
        args: [appId, keccak256(toHex(action))],
      })
      const names = kinds.map(idFor)
      return `<li><code>${action}</code><span>${names.length ? names.join(', ') : 'nothing extra'}</span>
        <button data-action="${action}" class="link">edit</button></li>`
    }),
  )
  el('actions').innerHTML = rows.join('') || '<li class="empty">No actions need extra proof yet.</li>'

  el('actions')
    .querySelectorAll('button[data-action]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        el('action-name').value = button.dataset.action
        el('action-name').scrollIntoView({ behavior: 'smooth' })
      }),
    )
}

async function register() {
  try {
    status('Confirm in your wallet…')
    const stake = await publicClient.readContract({
      address: config.contracts.appRegistry,
      abi: appRegistryAbi,
      functionName: 'MIN_STAKE',
    })

    const hash = await connected.client.writeContract({
      address: config.contracts.appRegistry,
      abi: appRegistryAbi,
      functionName: 'register',
      args: [appIdFor(label), el('aud').value.trim(), el('gateway').value.trim(), zeroHash],
      value: stake,
    })
    status('Staking…')
    await waitFor(hash)
    await load()
  } catch (error) {
    status(error.shortMessage ?? error.message)
  }
}

async function saveLogin() {
  try {
    const kinds = CREDENTIALS.filter((c) => el(`login-${c.id}`)?.checked).map((c) => kindHash(c.id))
    status('Confirm in your wallet…')
    const hash = await connected.client.writeContract({
      address: config.contracts.appRegistry,
      abi: appRegistryAbi,
      functionName: 'setPolicy',
      args: [appIdFor(label), zeroHash, kinds],
    })
    await waitFor(hash)
    status('Saved. Everyone signing in from now on is held to this.')
  } catch (error) {
    status(error.shortMessage ?? error.message)
  }
}

/**
 * The live change. Name an action, tick what it now requires, save — and a user already
 * signed in is refused the next time they try it until they satisfy the new rule.
 */
async function saveAction() {
  try {
    const action = el('action-name').value.trim()
    if (!action) return status('Name the action first — "bid", "withdraw", whatever the app calls it.')

    const kinds = CREDENTIALS.filter((c) => el(`step-${c.id}`)?.checked).map((c) => kindHash(c.id))
    status('Confirm in your wallet…')
    const hash = await connected.client.writeContract({
      address: config.contracts.appRegistry,
      abi: appRegistryAbi,
      functionName: 'setPolicy',
      args: [appIdFor(label), keccak256(toHex(action)), kinds],
    })
    await waitFor(hash)
    rememberAction(action)
    await refreshActions(appIdFor(label))
    status(`Saved. The next "${action}" is held to this — nothing was redeployed.`)
  } catch (error) {
    status(error.shortMessage ?? error.message)
  }
}

/** What the world sees, straight from the resolver rather than from our own state. */
async function showRecords() {
  if (!config.contracts.appResolver) return status('No resolver is configured.')
  const keys = ['manju.aud', 'manju.gateway', 'manju.login']
  const values = await Promise.all(
    keys.map((key) =>
      publicClient.readContract({
        address: config.contracts.appResolver,
        abi: resolverAbi,
        functionName: 'textFor',
        args: [label, key],
      }),
    ),
  )
  el('records').innerHTML = keys
    .map((key, i) => `<li><code>${key}</code><span>${values[i] || '—'}</span></li>`)
    .join('')
  el('records').hidden = false
}

function status(message) {
  el('status').textContent = message
}

function checkboxes(container, prefix) {
  el(container).innerHTML = CREDENTIALS.map(
    (c) => `<label class="check">
      <input type="checkbox" id="${prefix}-${c.id}" />
      <span><strong>${c.label}</strong><em>${c.note}</em></span>
    </label>`,
  ).join('')
}

checkboxes('login-methods', 'login')
checkboxes('step-methods', 'step')
el('soon').textContent = COMING_SOON.join(', ') + ' — coming soon'

el('connect').addEventListener('click', () => connect().catch((e) => status(e.message)))
el('load').addEventListener('click', () => load().catch((e) => status(e.message)))
el('do-register').addEventListener('click', register)
el('save-login').addEventListener('click', saveLogin)
el('save-action').addEventListener('click', saveAction)
el('show-records').addEventListener('click', () => showRecords().catch((e) => status(e.message)))
