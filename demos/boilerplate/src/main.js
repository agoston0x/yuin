/**
 * The smallest complete integration.
 *
 *   const manju = createClient({ appId })
 *   await manju.login()
 *   const gate = await manju.verify('enter')
 *
 * Signed in means an identity and an account. A gate returns a result rather than
 * throwing, because "you need to verify first" is a screen the app draws, not an error it
 * catches.
 */

// TODO
