/**
 * One half of an email one-time code.
 *
 * A user signing up with email gets two codes from two senders who do not know each
 * other: this one, and the app's own. Each sender publishes only `H(code‖email‖nonce)`,
 * so neither can sign anyone in alone and neither is worth compromising on its own.
 *
 * The password matters more than either code. The identity key folds in an Argon2 stretch
 * of it, so both senders colluding without the password land on a different, empty
 * identity.
 */

// TODO
