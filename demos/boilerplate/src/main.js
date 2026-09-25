/**
 * The smallest complete integration, and a tour of the four things every app ends up
 * wanting: sign in, see who you are, gate an action, and show what is still missing.
 *
 *   const manju = await createClient({ app })
 *   manju.session          // null, or an account address
 *   manju.login()          // leaves the page and comes back signed in
 *   await manju.verify('x') // { ok } or { ok: false, missing: [...] }
 *
 * There is no `onAuthStateChanged`, no provider component, no context. A page either has
 * a session or it does not, and the answer is the same on every reload.
 */
import { client } from './manju.js'
import { gateFor } from './gates.js'
import { render } from './ui.js'

const state = {
  session: client.session,
  loginPolicy: await client.loginPolicy(),
  message: '',
}

function refresh() {
  render(state, {
    onLogin: () => client.login(),
    onLogout: () => {
      client.logout()
      state.session = null
      state.message = ''
      refresh()
    },
    onProtected: async () => {
      // The gate is read from chain at the moment of the click, not when the page loaded.
      const gate = await gateFor(client, 'protected')
      state.message = gate.ok
        ? 'Allowed. This is where the app does the thing.'
        : `Not yet — this action needs ${gate.missing.join(', ')}.`
      refresh()
    },
  })
}

refresh()
