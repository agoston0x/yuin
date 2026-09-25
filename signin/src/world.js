/**
 * World via IDKit. A selfie proves a live human; a passport proves an age.
 *
 * Verified under our own app id, with the result linked to the identity — an app receives
 * the fact, never the proof, and cannot reuse it elsewhere.
 */

export async function verifySelfie({ action, signal }) {}

export async function verifyPassportAge({ action, signal, minAge }) {}
