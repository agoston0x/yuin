#!/usr/bin/env bash
# Bring up the node set and stake each one into NodeRegistry.
#
# Until those transactions land the nodes are running but in no committee, which looks
# exactly like a broken node and is the first thing to check when a login hangs.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f scripts/.env ] && set -a && . scripts/.env && set +a
[ -f scripts/addresses.env ] && set -a && . scripts/addresses.env && set +a

: "${SEPOLIA_RPC:?set SEPOLIA_RPC}"
: "${NODE_REGISTRY:?run deploy.sh first}"

COUNT="${1:-5}"
BASE_PORT="${BASE_PORT:-8700}"

echo "starting $COUNT nodes…"
for i in $(seq 1 "$COUNT"); do
  port=$((BASE_PORT + i - 1))
  key_var="NODE_${i}_PRIVATE_KEY"
  key="${!key_var:-}"
  [ -z "$key" ] && { echo "set $key_var"; exit 1; }

  gateway="${NODE_GATEWAY_PREFIX:-http://localhost}:$port"
  address=$(cast wallet address --private-key "$key")

  already=$(cast call "$NODE_REGISTRY" "isActive(address)(bool)" "$address" --rpc-url "$SEPOLIA_RPC")
  if [ "$already" = "true" ]; then
    echo "node $i ($address) is already staked"
    continue
  fi

  stake=$(cast call "$NODE_REGISTRY" "MIN_STAKE()(uint256)" --rpc-url "$SEPOLIA_RPC" | awk '{print $1}')
  echo "staking node $i ($address) at $gateway"
  cast send "$NODE_REGISTRY" "join(string,bytes)" "$gateway" "0x" \
    --value "$stake" --private-key "$key" --rpc-url "$SEPOLIA_RPC" >/dev/null
done

echo
cast call "$NODE_REGISTRY" "activeSet()(address[])" --rpc-url "$SEPOLIA_RPC"
echo "threshold: $(cast call "$NODE_REGISTRY" "threshold()(uint256)" --rpc-url "$SEPOLIA_RPC")"
