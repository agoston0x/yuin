#!/usr/bin/env bash
# Build the sign-in page, upload it to Swarm, and record its hash so a tampered copy is
# detectable. The build must be reproducible or the recorded hash proves nothing — build
# twice and compare before trusting what this prints.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f scripts/.env ] && set -a && . scripts/.env && set +a
[ -f scripts/addresses.env ] && set -a && . scripts/addresses.env && set +a

: "${BEE_API:?set BEE_API}"
: "${POSTAGE_BATCH_ID:?set POSTAGE_BATCH_ID}"

echo "building…"
(cd signin && npm run build)

first=$(cat signin/dist/frontend-hash.txt)
(cd signin && npm run build >/dev/null)
second=$(cat signin/dist/frontend-hash.txt)

if [ "$first" != "$second" ]; then
  echo "the build is not reproducible — the recorded hash would mean nothing" >&2
  exit 1
fi

echo "frontend hash: $first"
echo "uploading to swarm…"

reference=$(curl -sS -X POST "$BEE_API/bzz?name=signin" \
  -H "swarm-postage-batch-id: $POSTAGE_BATCH_ID" \
  -H "swarm-collection: true" \
  -H "swarm-index-document: index.html" \
  -H "content-type: application/x-tar" \
  --data-binary @<(tar -C signin/dist -cf - .) | sed -E 's/.*"reference":"([^"]+)".*/\1/')

echo
echo "swarm reference: $reference"
echo "  https://bzz.link/bzz/$reference/"
echo
echo "record it as the app's frontend hash with:"
echo "  cast send \$APP_REGISTRY 'update(bytes32,string,string,bytes32)' <appId> <aud> <gateway> $first"
