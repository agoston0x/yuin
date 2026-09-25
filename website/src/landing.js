/**
 * The landing page is mostly words, and the words are in the HTML. What is here is the
 * one thing worth doing live: reading the current node set, so the claim that anyone can
 * run one is accompanied by the number of people who do.
 */
import { publicClient } from './chain.js'
import { config } from './config.js'

const nodeRegistryAbi = [
  { type: 'function', name: 'activeSet', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'threshold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
]

async function showNodes() {
  const target = document.getElementById('nodes')
  if (!target || !config.contracts.nodeRegistry) return

  try {
    const [active, threshold] = await Promise.all([
      publicClient.readContract({
        address: config.contracts.nodeRegistry,
        abi: nodeRegistryAbi,
        functionName: 'activeSet',
      }),
      publicClient.readContract({
        address: config.contracts.nodeRegistry,
        abi: nodeRegistryAbi,
        functionName: 'threshold',
      }),
    ])
    target.textContent = `${threshold} of ${active.length} nodes have to agree before anyone is signed in.`
  } catch {
    target.textContent = 'The node set could not be read just now.'
  }
}

showNodes()
