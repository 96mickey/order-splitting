#!/usr/bin/env bash
# Order Splitter — exercise every HTTP route (same defaults as before: 127.0.0.1:3010).
# Requires: curl, jq. Server running (e.g. npm run dev). Optional: uuidgen for a fresh idempotency key.
#
#   BASE=http://localhost:3010 ./postman/curl-examples.sh
#   IDEMPOTENCY_KEY=my-fixed-key ./postman/curl-examples.sh

set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3010}"
KEY="${IDEMPOTENCY_KEY:-$(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440000")}"

echo "== BASE=$BASE  Idempotency-Key=$KEY =="

echo ">> GET /healthz"
curl -sS "$BASE/healthz" | jq .

echo ">> GET /readyz"
curl -sS "$BASE/readyz" | jq .

echo ">> GET /config"
curl -sS "$BASE/config" | jq .

echo ">> GET /api/v1/example/ping"
curl -sS "$BASE/api/v1/example/ping" | jq .

SPLIT_BODY='{"totalAmount":100,"orderType":"BUY","stocks":[{"symbol":"AAPL","weight":60},{"symbol":"TSLA","weight":40}]}'

echo ">> POST /orders/split (first request — expect 201)"
FIRST=$(curl -sS -X POST "$BASE/orders/split" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $KEY" \
  -d "$SPLIT_BODY")
echo "$FIRST" | jq .
ORDER_ID=$(echo "$FIRST" | jq -r '.orderId')
if [[ -z "$ORDER_ID" || "$ORDER_ID" == "null" ]]; then
  echo "error: no orderId in split response" >&2
  exit 1
fi

echo ">> POST /orders/split (replay same key + body — expect 200, idempotencyHit true)"
curl -sS -X POST "$BASE/orders/split" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $KEY" \
  -d "$SPLIT_BODY" | jq .

echo ">> GET /orders"
curl -sS "$BASE/orders" | jq .

echo ">> GET /orders/$ORDER_ID"
curl -sS "$BASE/orders/$ORDER_ID" | jq .

echo ">> PATCH /config (example: maxDecimalPlaces 7)"
curl -sS -X PATCH "$BASE/config" \
  -H 'Content-Type: application/json' \
  -d '{"maxDecimalPlaces":7}' | jq .

echo ">> Done."
