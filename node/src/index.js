/**
 * Boot: open the share channel, then start answering.
 *
 * Nothing here is stateful. A node that restarts has lost nothing worth keeping, and
 * rejoins the set the moment it can hear GSOC again.
 */
import { config } from './config.js'
import { createServer } from './server.js'
import { start as startCommander } from './commander.js'
import { account } from './chain.js'
import * as gsoc from './gsoc.js'

const health = await gsoc.health().catch(() => null)
if (!health?.reachable) {
  console.warn('bee is not reachable — shares cannot be exchanged until it is')
} else if (!health.fullNode) {
  console.warn(`bee is running as "${health.mode}" — GSOC subscription needs a full node`)
} else {
  await startCommander()
}

createServer().listen(config.port, () => {
  console.log(`node ${account.address} listening on :${config.port}`)
})
