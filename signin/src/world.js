/**
 * World, via IDKit.
 *
 * Two credentials, asked for two different reasons. A selfie says a live person is here
 * right now — which is what an auction needs before it accepts a bid, and what a game that
 * pays out needs before it accepts a player. A passport says an adult exists — which is a
 * legal question about who may buy alcohol, established once at the door rather than
 * re-asked on every click.
 *
 * Both verify under this protocol's own app id, not the app's. That is deliberate: the
 * scope is set once, so a person is the same person across every app here, and an app
 * receives the fact that a check passed rather than a proof it could replay somewhere else.
 */
// The standalone build attaches itself to the page rather than exporting anything, so it
// is imported for its side effect and reached through the global it defines.
import '@worldcoin/idkit-standalone'

const ORB = 'orb'
const DOCUMENT = 'document'

function widget() {
  const idkit = globalThis.IDKit
  if (!idkit) throw new Error('the World widget did not load')
  return idkit
}

/** `signal` binds the proof to who is asking and what for. */
export async function verify({ appId, action, signal, level = ORB }) {
  if (!appId) throw new Error('no World app id is configured')
  return new Promise((resolve, reject) => {
    widget().init({
      app_id: appId,
      action,
      signal,
      verification_level: level,
      onSuccess: resolve,
      onError: reject,
    })
    widget().open()
  })
}

/** A live human. What the auction demands before a bid, and the game before a move. */
export function verifySelfie({ appId, signal, action = 'human' }) {
  return verify({ appId, action, signal, level: ORB })
}

/**
 * Age, from a passport. This sits under World's Identity Check, which is in preview — if
 * it is unavailable the honest fallback is passport possession without the age assertion,
 * and the app should be told which of the two it got rather than being left to assume.
 */
export function verifyAge({ appId, signal, action = 'age' }) {
  return verify({ appId, action, signal, level: DOCUMENT })
}
