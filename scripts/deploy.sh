#!/usr/bin/env bash
# Put the contracts on Sepolia and write their addresses into addresses.env, which every
# other script here reads. Run once; running it again deploys a second, unrelated system.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f scripts/.env ] && set -a && . scripts/.env && set +a

: "${SEPOLIA_RPC:?set SEPOLIA_RPC}"
: "${DEPLOYER_PRIVATE_KEY:?set DEPLOYER_PRIVATE_KEY}"

echo "deploying to sepolia…"
output=$(forge script contracts/script/Deploy.s.sol:Deploy \
  --root contracts \
  --rpc-url "$SEPOLIA_RPC" \
  --broadcast \
  ${ETHERSCAN_API_KEY:+--verify} \
  -vvv)

echo "$output"

# The script logs each address as NAME=0x…; keep those lines and nothing else.
echo "$output" | grep -Eo '(NODE_REGISTRY|APP_REGISTRY|IDENTITY_REGISTRY|ACCOUNT_FACTORY|APP_RESOLVER)=0x[0-9a-fA-F]{40}' \
  > scripts/addresses.env

echo
echo "wrote scripts/addresses.env:"
cat scripts/addresses.env
