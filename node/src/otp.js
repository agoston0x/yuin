/**
 * One half of an email code.
 *
 * This node mails a code and publishes only `H(code‖email‖nonce)`. The other half comes
 * from a sender we do not control, which is what stops either of us signing someone in
 * alone.
 */

export async function issue({ email, nonce }) {}

export async function checkCommitment({ email, nonce, code }) {}
