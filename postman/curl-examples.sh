#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3010}"

curl -sS "$BASE/healthz" | jq .
curl -sS "$BASE/readyz" | jq .
curl -sS "$BASE/api/v1/example/ping" | jq .

curl -sS "$BASE/orders" | jq .

IDEMPOTENCY_KEY="$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]' || python3 -c 'import uuid; print(uuid.uuid4())')"
curl -sS -X POST "$BASE/orders/split" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{"totalAmount":100,"orderType":"BUY","stocks":[{"symbol":"AAPL","weight":60},{"symbol":"TSLA","weight":40}]}' | jq .
