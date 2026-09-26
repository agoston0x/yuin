#!/usr/bin/env bash
# Register the demo apps and set their opening policies.
#
# The auction's bid gate is left empty on purpose. Adding it live, from the console, in
# front of the judges, is the demo — so it must not already be there.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f scripts/.env ] && set -a && . scripts/.env && set +a
[ -f scripts/addresses.env ] && set -a && . scripts/addresses.env && set +a

: "${SEPOLIA_RPC:?set SEPOLIA_RPC}"
: "${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY}"
: "${APP_REGISTRY:?run deploy.sh first}"

GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
stake=$(cast call "$APP_REGISTRY" "MIN_STAKE()(uint256)" --rpc-url "$SEPOLIA_RPC" | awk '{print $1}')

kind() { cast keccak "$(cast from-utf8 "$1")"; }
app_id() { cast keccak "$(cast from-utf8 "$1")"; }

register() {
  local label="$1" aud="$2"
  local id; id=$(app_id "$label")

  if [ "$(cast call "$APP_REGISTRY" "isRegistered(bytes32)(bool)" "$id" --rpc-url "$SEPOLIA_RPC")" = "true" ]; then
    echo "$label is already registered"
    return
  fi

  echo "registering $label"
  cast send "$APP_REGISTRY" "register(bytes32,string,string,bytes32)" \
    "$id" "$aud" "" "$(cast --to-bytes32 0)" \
    --value "$stake" --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$SEPOLIA_RPC" >/dev/null
}

set_policy() {
  local label="$1" action="$2"; shift 2
  local id; id=$(app_id "$label")
  local action_hash
  if [ "$action" = "login" ]; then action_hash=$(cast --to-bytes32 0); else action_hash=$(kind "$action"); fi

  local kinds="["
  local first=1
  for k in "$@"; do
    [ $first -eq 0 ] && kinds="$kinds,"
    kinds="$kinds$(kind "$k")"
    first=0
  done
  kinds="$kinds]"

  echo "  $label/$action -> $*"
  cast send "$APP_REGISTRY" "setPolicy(bytes32,bytes32,bytes32[])" "$id" "$action_hash" "$kinds" \
    --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$SEPOLIA_RPC" >/dev/null
}

register boilerplate "$GOOGLE_CLIENT_ID"
set_policy boilerplate login google passkey

register auction "$GOOGLE_CLIENT_ID"
set_policy auction login google world.age
# `bid` is deliberately left open — the live change is the demo.

register game "$GOOGLE_CLIENT_ID"
set_policy game login email passkey
set_policy game play world.selfie

echo
echo "done. read them back from the resolver:"
echo "  cast call \$APP_RESOLVER 'textFor(string,string)(string)' auction yuin.login --rpc-url \$SEPOLIA_RPC"
