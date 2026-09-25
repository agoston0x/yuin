/**
 * WebAuthn. The credential that keeps working when a provider does not, and the reason
 * an ordinary login touches no nodes and writes nothing to a chain.
 *
 * A passkey is bound to an origin, so this page lives at one fixed domain and stays there.
 */

export async function createPasskey({ identity }) {}

export async function assertPasskey({ challenge }) {}
