/**
 * Tic-tac-toe for two, on phones.
 *
 * Deliberately the path with no OAuth provider at all: an email code plus a passkey, to
 * show an identity can exist without Google being involved in any of it. A World selfie is
 * required to join, because a bot that never loses is the obvious attack on a game that
 * pays out — and unlike the auction, here the gate is at the door, since there is no
 * later moment that matters more than the first move.
 *
 * Mentioned in the pitch rather than demoed: a second person's phone is the one thing on
 * stage that cannot be rehearsed.
 */
import { createClient } from '@manju/sdk'
import { newBoard, play, winner } from './board.js'
import { playingForTokens } from './stakes.js'

const client = await createClient({
  app: process.env.APP_LABEL || 'game',
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
let board = newBoard()
let turn = 'X'

async function boot() {
  if (!client.session) {
    const entry = await client.loginPolicy()
    el('app').innerHTML = `
      <h1>Marubatsu</h1>
      <p class="lede">Two players. One board. ${playingForTokens() ? 'Winner takes the pot.' : 'No stakes today.'}</p>
      <p>To play you need: <strong>${entry.join(', ') || 'an account'}</strong>.</p>
      <p class="hint">The selfie is not about who you are. It is about whether you are.</p>
      <button id="join" class="primary">Join</button>`
    el('join').addEventListener('click', () => client.login())
    return
  }

  const gate = await client.verify('play')
  if (!gate.ok) {
    el('app').innerHTML = `
      <h1>Nearly</h1>
      <p>Joining a game needs ${gate.missing.join(' and ')}.</p>
      <p class="hint">Open World, verify, then come back.</p>`
    return
  }

  renderBoard()
}

function renderBoard() {
  const result = winner(board)
  el('app').innerHTML = `
    <h1>Marubatsu</h1>
    <p class="turn">${
      result ? (result.player ? `${result.player} wins` : 'A draw') : `${turn} to play`
    }</p>
    <div class="board">
      ${board
        .map(
          (cell, i) =>
            `<button class="cell" data-i="${i}" ${cell || result ? 'disabled' : ''}>${cell ?? ''}</button>`,
        )
        .join('')}
    </div>
    ${result ? '<button id="again">Play again</button>' : ''}
    <p class="hint">No signature since you joined — the session key already covers this.</p>`

  el('app')
    .querySelectorAll('.cell')
    .forEach((button) =>
      button.addEventListener('click', () => {
        board = play(board, Number(button.dataset.i), turn)
        turn = turn === 'X' ? 'O' : 'X'
        renderBoard()
      }),
    )

  el('again')?.addEventListener('click', () => {
    board = newBoard()
    turn = 'X'
    renderBoard()
  })
}

boot()
