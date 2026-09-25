/**
 * One node drives each request: collect shares until three agree on the same digest,
 * aggregate them, submit one transaction.
 *
 * Which node commands is not a privilege. It can stall, and that is all — it cannot forge
 * anything the other two did not already sign.
 */

export async function collect(digest, { threshold = 3, timeoutMs = 10_000 } = {}) {}

export async function aggregate(shares) {}
