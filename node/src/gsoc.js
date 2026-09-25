/**
 * The channel between nodes.
 *
 * A single-owner chunk address several nodes can write to and subscribe to: no server, no
 * node needing another's address, nothing left behind once the stamp lapses. Receiving
 * requires the Bee alongside this process to be a full node.
 */

export async function subscribe(topic, onMessage) {}

export async function publish(topic, payload) {}
