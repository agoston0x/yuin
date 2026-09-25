/**
 * Sign-up with no provider at all.
 *
 * Two independent senders each mail a code; both are required. The identity key folds in
 * an Argon2 stretch of the user's password, so the two senders colluding without it land
 * on a different, empty identity. Email may create an identity. It may not recover one.
 */

export async function requestCodes({ email }) {}

export async function redeem({ email, codes, password }) {}
