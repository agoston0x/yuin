/**
 * A sake auction.
 *
 * Two credentials, each with a reason that would survive being questioned. Age, because
 * selling alcohol to a minor is illegal — established once at the door, since asking per
 * bid would be theatre. A live person, because one script can outbid every human in the
 * room — asked at the bid, which is the moment that actually matters.
 *
 * Nothing else is gated. Looking at a lot needs no proof of anything, and demanding one
 * would be the exact mistake a policy system exists to prevent.
 */
import { createClient } from '@manju/sdk'
import { LOTS, lotById } from './lots.js'
import { attemptBid } from './bid.js'
import { configured } from './pay.js'

const client = await createClient({
  app: process.env.APP_LABEL || 'auction',
  signinUrl: process.env.SIGNIN_URL,
  rpc: process.env.SEPOLIA_RPC,
  contracts: {
    appRegistry: process.env.APP_REGISTRY,
    nodeRegistry: process.env.NODE_REGISTRY,
    identityRegistry: process.env.IDENTITY_REGISTRY,
    accountFactory: process.env.ACCOUNT_FACTORY,
  },
})

const el = (id) => document.getElementById(id)
const yen = (n) => `¥${Number(n).toLocaleString('ja-JP')}`

async function boot() {
  const entry = await client.loginPolicy()

  if (!client.session) {
    el('app').innerHTML = `
      <header>
        <h1>Kuramoto Auction</h1>
        <p class="lede">Rare sake, sold on the day it is poured.</p>
      </header>
      <section class="door">
        <h2>Members only</h2>
        <p>To come in you need: <strong>${entry.join(', ') || 'an account'}</strong>.</p>
        <p class="hint">
          Age is checked once, at the door. We do not learn your birthday, your name, or
          your passport number — only that someone old enough is standing here.
        </p>
        <button id="enter" class="primary">Sign in</button>
      </section>`
    el('enter').addEventListener('click', () => client.login())
    return
  }

  renderRoom()
}

function renderRoom() {
  el('app').innerHTML = `
    <header>
      <h1>Kuramoto Auction</h1>
      <p class="lede">Bidding as <code>${client.session.account}</code></p>
    </header>
    <ul class="lots">
      ${LOTS.map(
        (lot) => `
        <li>
          <div>
            <strong>${lot.name}</strong>
            <em>${lot.detail}</em>
          </div>
          <div class="price">
            <span>${yen(lot.priceJpy)}</span>
            <button data-lot="${lot.id}" class="primary">Bid</button>
          </div>
        </li>`,
      ).join('')}
    </ul>
    <p class="pay-note">${
      configured()
        ? 'Prices are in JPY. You pay in whatever you hold — the conversion happens inside the bid.'
        : 'Payment tokens are not configured in this build, so bids stop at the gate.'
    }</p>
    <p id="message" class="message"></p>
  `

  el('app')
    .querySelectorAll('button[data-lot]')
    .forEach((button) => button.addEventListener('click', () => bid(button.dataset.lot)))
}

async function bid(lotId) {
  const lot = lotById(lotId)
  message('Checking what this bid requires…')

  const result = await attemptBid(client, lot)
  if (!result.allowed) {
    // Deliberately a rendered state and not an error. The user is not wrong; they are
    // simply not finished.
    message(`${result.because} Open World to verify, then bid again.`, 'blocked')
    return
  }

  if (!configured()) {
    message(`Allowed — ${lot.name} for ${yen(lot.priceJpy)}. No payment tokens in this build.`, 'ok')
    return
  }

  message(`Bid placed on ${lot.name} for ${yen(lot.priceJpy)}, paid in your own token.`, 'ok')
}

function message(text, kind = '') {
  const node = el('message')
  if (node) {
    node.textContent = text
    node.dataset.kind = kind
  }
}

boot()
