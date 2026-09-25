/**
 * The channel between nodes.
 *
 * GSOC is a single-owner chunk at an address several writers can reach: every node
 * publishes its share to the same place and every node is subscribed to it. There is no
 * broker, no node needs another's IP, and nothing survives its postage stamp — the shares
 * for a login are gone long before anyone could mine them for anything.
 *
 * Receiving requires the Bee alongside this process to be a full node. A light node will
 * subscribe without complaint and then hear nothing at all, which is a miserable thing to
 * debug at three in the morning, so `health()` says so plainly.
 */
import { Bee } from '@ethersphere/bee-js'
import { config } from './config.js'

let bee = null
const client = () => (bee ??= new Bee(config.bee.api))

/**
 * The shared address. Every node mines an identity into the same neighbourhood so their
 * writes land on one chunk; the topic is what makes that chunk this protocol's.
 */
export function topic() {
  return config.bee.topic
}

export async function health() {
  const status = await client().getNodeInfo()
  return {
    reachable: true,
    fullNode: status.beeMode === 'full',
    mode: status.beeMode,
  }
}

export async function publish(payload) {
  if (!config.bee.batch) throw new Error('no postage batch: this node cannot write to Swarm')
  return client().gsocSend(config.bee.batch, topic(), JSON.stringify(payload))
}

export async function subscribe(onMessage) {
  return client().gsocSubscribe(topic(), {
    onMessage: (message) => {
      try {
        onMessage(JSON.parse(message.toUtf8()))
      } catch {
        // A malformed message is a stranger's problem, not a reason to stop listening.
      }
    },
    onError: () => {},
  })
}
