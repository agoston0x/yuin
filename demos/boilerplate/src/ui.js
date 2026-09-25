/** Deliberately plain. This file exists to be read, not admired. */
const el = document.getElementById('app')

export function render(state, handlers) {
  el.innerHTML = state.session ? signedIn(state) : signedOut(state)

  document.getElementById('login')?.addEventListener('click', handlers.onLogin)
  document.getElementById('logout')?.addEventListener('click', handlers.onLogout)
  document.getElementById('protected')?.addEventListener('click', handlers.onProtected)
}

function signedOut(state) {
  const needs = state.loginPolicy.length ? state.loginPolicy.join(', ') : 'nothing configured yet'
  return `
    <h1>A boilerplate app</h1>
    <p>To sign in here you need: <strong>${needs}</strong>.</p>
    <p class="hint">That list comes from this app's record on chain, not from this page.</p>
    <button id="login" class="primary">Sign in</button>
  `
}

function signedIn(state) {
  return `
    <h1>Signed in</h1>
    <p>Your account in this app: <code>${state.session.account}</code></p>
    <p class="hint">
      A different app would see a different address for you. They cannot be matched up.
    </p>
    <button id="protected" class="primary">Do the protected thing</button>
    <p class="message">${state.message}</p>
    <button id="logout">Sign out</button>
  `
}
