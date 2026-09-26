#!/usr/bin/env bash
#
# The whole pivot path against a real chain, end to end, with nothing mocked:
# anvil, the contracts deployed, two sender processes running with different keys, and an
# account created from an email address and a password.
#
# It exists because every piece of this passes its own tests in isolation and that proves
# nothing about whether they agree with each other. The digest the senders sign has to be
# the digest the contract reconstructs, byte for byte, or the signatures are worthless —
# and that is exactly the kind of thing unit tests on either side will both happily miss.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
RPC=http://127.0.0.1:8545

# anvil's first three accounts. Public knowledge, worthless, and the same everywhere.
DEPLOYER=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
SENDER_ONE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
SENDER_TWO_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
SENDER_ONE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
SENDER_TWO=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

cleanup() {
  for pid in "${ANVIL_PID:-}" "${ONE_PID:-}" "${TWO_PID:-}"; do
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1. a chain"
anvil --silent --port 8545 &
ANVIL_PID=$!
until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do sleep 0.2; done
echo "   anvil up"

say "2. the contracts"
cd "$ROOT/contracts"
# foundry.toml names an etherscan key, and forge resolves it even when nothing is being
# verified. Nothing here is.
export ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-unused}"
OUT=$(DEPLOYER_PRIVATE_KEY=$DEPLOYER SENDER_ONE=$SENDER_ONE SENDER_TWO=$SENDER_TWO \
  forge script script/DeployPivot.s.sol:DeployPivot --rpc-url "$RPC" --broadcast 2>&1) || true

REGISTRY=$(echo "$OUT" | grep -oE 'EMAIL_IDENTITY_REGISTRY=0x[0-9a-fA-F]{40}' | head -1 | cut -d= -f2)
if [ -z "$REGISTRY" ]; then
  echo "$OUT" | tail -30
  echo "deploy failed"
  exit 1
fi
echo "   registry $REGISTRY"

say "3. two senders"
cd "$ROOT/senders"
SENDER_LABEL=One SENDER_PRIVATE_KEY=$SENDER_ONE_KEY EMAIL_IDENTITY_REGISTRY=$REGISTRY \
  CHAIN_ID=31337 SEPOLIA_RPC=$RPC PORT=8760 node src/index.js > /tmp/yuin-sender-one.log 2>&1 &
ONE_PID=$!
SENDER_LABEL=Two SENDER_PRIVATE_KEY=$SENDER_TWO_KEY EMAIL_IDENTITY_REGISTRY=$REGISTRY \
  CHAIN_ID=31337 SEPOLIA_RPC=$RPC PORT=8761 node src/index.js > /tmp/yuin-sender-two.log 2>&1 &
TWO_PID=$!

for port in 8760 8761; do
  until curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1; do sleep 0.3; done
  echo "   :$port $(curl -s http://127.0.0.1:$port/health | sed -E 's/.*"signer":"([^"]+)".*/\1/')"
done

say "4. sign up"
REGISTRY=$REGISTRY RPC=$RPC node "$ROOT/scripts/e2e-pivot.mjs"
