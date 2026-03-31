#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3010}"

curl -sS "$BASE/healthz" | jq .
curl -sS "$BASE/readyz" | jq .
curl -sS "$BASE/api/v1/example/ping" | jq .
