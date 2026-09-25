/**
 * The sign-in page.
 *
 * It renders what the app asked for and nothing else. The list of buttons is not written
 * here — it comes from the app's record on chain, so an app that wants only a passkey
 * never shows a Google button, and an app that added an age check this morning shows it
 * this morning.
 *
 * Four things can be happening at once and the page says which: waiting for a provider,
 * waiting for nodes, blocked by a requirement, or done.
 */
import * as session from './session.js'
import * as google from './google.js'
import * as passkey from './passkey.js'
import * as world from './world.js'
import * as email from './email.js'
import { post } from './nodes.js'
import { appIdFor, appRecord, policyFor } from './policy.js'
import { config } from './config.js'

const params = new URLSearchParams(location.search)
const appLabel = params.get('app') ?? ''
const returnTo = params.get('return_to') ?? ''
// The app generates its own session key and sends the public half; see session.js.
const offeredKey = params.get('session_pk') ?? ''

const el = document.getElementById('app')

function render(html) {
  el.innerHTML = html
}

function status(message, kind = 'info') {
  const node = document.getElementById('status')
  if (node) {
    node.textContent = message
    node.dataset.kind = kind
  }
}

function finish(result) {
  if (!returnTo) return render(`<p class="ok">Signed in as <code>${result.identity}</code></p>`)
  const url = new URL(returnTo)
  url.hash = new URLSearchParams({ identity: result.identity, session: session.current().address }).toString()
  location.href = url.toString()
}

async function boot() {
  if (!appLabel) return render('<p class="error">No app named. Open this page from an app.</p>')

  const appId = appIdFor(appLabel)
  let app
  try {
    app = await appRecord(appId)
  } catch {
    return render(`<p class="error">No app is registered as <code>${appLabel}</code>.</p>`)
  }

  // Coming back from Google: the token is in the fragment, so finish the job first.
  const callback = google.tokenFromCallback()
  if (callback) return completeGoogle(appId, callback.token)

  const required = await policyFor(appId)
  render(page({ appLabel, required }))
  wire({ appId, app, required })
}

function page({ appLabel, required }) {
  const methods = required.length ? required : ['google']
  const buttons = methods
    .map((kind) => {
      if (kind === 'google') return `<button id="google" class="primary">Continue with Google</button>`
      if (kind === 'email') return `<button id="email" class="ghost">Use an email code</button>`
      if (kind === 'passkey') return ''
      if (kind === 'world.age') return `<p class="note">This app checks your age with World.</p>`
      if (kind === 'world.selfie') return `<p class="note">This app checks you are a live person.</p>`
      return `<p class="note">This app requires <code>${kind}</code>, which this page does not know how to do.</p>`
    })
    .join('')

  return `
    <h1>Sign in to ${appLabel}</h1>
    <div class="methods">${buttons}</div>
    <div id="email-form" hidden>
      <input id="email-address" type="email" placeholder="you@example.com" autocomplete="email" />
      <input id="email-password" type="password" placeholder="A password only you know" autocomplete="new-password" />
      <button id="email-send" class="primary">Send me two codes</button>
      <div id="email-codes" hidden>
        <input id="code-1" inputmode="numeric" placeholder="Code from Manju" />
        <input id="code-2" inputmode="numeric" placeholder="Code from the app" />
        <button id="email-redeem" class="primary">Sign in</button>
      </div>
    </div>
    <p id="status"></p>
    <p class="fine">Your key is made on this device and never leaves it.</p>
  `
}

function wire({ appId, app, required }) {
  document.getElementById('google')?.addEventListener('click', () => {
    const s = offeredKey ? session.adopt(offeredKey) : session.create()
    status('Sending you to Google…')
    google.redirectToGoogle({
      clientId: app.aud,
      session: s,
      redirectUri: location.origin + location.pathname,
      state: appLabel,
    })
  })

  document.getElementById('email')?.addEventListener('click', () => {
    document.getElementById('email-form').hidden = false
  })

  document.getElementById('email-send')?.addEventListener('click', async () => {
    try {
      status('Asking two senders for a code…')
      const address = document.getElementById('email-address').value.trim()
      const { nonce } = await email.requestCodes({ email: address })
      sessionStorage.setItem('manju.otp', JSON.stringify({ nonce, address }))
      document.getElementById('email-codes').hidden = false
      status('Two codes are on their way. Both are needed.')
    } catch (error) {
      status(error.message, 'error')
    }
  })

  document.getElementById('email-redeem')?.addEventListener('click', async () => {
    try {
      const { nonce, address } = JSON.parse(sessionStorage.getItem('manju.otp'))
      const s = offeredKey ? session.adopt(offeredKey) : session.create()
      status('Checking with the nodes…')
      const result = await email.redeem({
        email: address,
        nonce,
        codes: [document.getElementById('code-1').value, document.getElementById('code-2').value],
        password: document.getElementById('email-password').value,
        session: s,
      })
      await afterIdentity(result, required)
    } catch (error) {
      status(error.message, 'error')
    }
  })
}

async function completeGoogle(appId, token) {
  render('<h1>Signing you in…</h1><p id="status"></p>')
  try {
    const s = session.current()
    if (!s) throw new Error('this sign-in started in another tab, so the key is gone — try again')

    status('Asking the nodes to verify your token…')
    const result = await post('/login', {
      token,
      appId,
      sessionPublicKey: s.publicKey,
      sessionAddress: s.address,
    })

    await afterIdentity(result, await policyFor(appId))
  } catch (error) {
    status(error.message, 'error')
  }
}

/**
 * An identity exists. Now the things the app insists on before it will let anyone in —
 * a passkey so the account survives losing this provider, and any World check the policy
 * names. Skipping these would hand back an account nobody can recover.
 */
async function afterIdentity(result, required) {
  if (required.includes('passkey') && passkey.supported()) {
    status('Add a passkey so you can get back in without Google.')
    await passkey.create({ identity: result.identity, label: 'Manju' }).catch(() => {
      status('No passkey was added — you can add one later from your dashboard.', 'warn')
    })
  }

  for (const kind of required) {
    if (kind === 'world.age' || kind === 'world.selfie') {
      status(kind === 'world.age' ? 'This app needs to check your age.' : 'This app needs to check you are a person.')
      const verifier = kind === 'world.age' ? world.verifyAge : world.verifySelfie
      await verifier({ appId: config.worldAppId, signal: result.identity })
    }
  }

  finish(result)
}

boot().catch((error) => render(`<p class="error">${error.message}</p>`))
