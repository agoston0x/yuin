/**
 * Gathering enough signatures to act.
 *
 * Whichever node a browser happened to reach becomes the commander for that request: it
 * publishes its own share, listens for the others, and submits once it has a majority.
 * Commanding is not a privilege — every share is checked against the digest the commander
 * itself computed, so a dishonest commander can stall a login and nothing else.
 *
 * Shares are held per digest rather than per request, so two nodes commanding the same
 * login at once converge instead of racing.
 */
import { publish, subscribe } from './gsoc.js'

const waiting = new Map() // digest => { shares: Map<signer, sig>, resolve, threshold }

export async function start() {
  await subscribe((message) => {
    if (message?.kind !== 'share') return
    offer(message.digest, message.signer, message.signature)
  })
}

/** A share arrived, from GSOC or from ourselves. */
export function offer(digest, signer, signature) {
  const pending = waiting.get(digest)
  if (!pending) return
  pending.shares.set(signer.toLowerCase(), signature)
  if (pending.shares.size >= pending.threshold) pending.settle()
}

/**
 * Signatures come back sorted by signer address, because that is the order the registry
 * insists on — it is how duplicates are excluded in a single pass on chain.
 */
export async function collect({ digest, threshold, ownShare, timeoutMs = 15000 }) {
  const existing = waiting.get(digest)
  if (existing) return existing.promise

  let settle
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`only ${waiting.get(digest)?.shares.size ?? 0} of ${threshold} nodes answered`)),
      timeoutMs,
    )
    settle = () => {
      clearTimeout(timer)
      const shares = [...waiting.get(digest).shares.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(0, threshold)
      waiting.delete(digest)
      resolve(shares.map(([, signature]) => signature))
    }
  })

  waiting.set(digest, { shares: new Map(), threshold, settle, promise })

  offer(digest, ownShare.signer, ownShare.signature)
  await publish({ kind: 'share', digest, signer: ownShare.signer, signature: ownShare.signature })

  return promise
}
