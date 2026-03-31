#!/usr/bin/env bash
# Run from repo root or set BASE_URL. Usage: ./postman/curl-examples.sh
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3010}"

echo "=== GET /healthz ==="
curl -sS "${BASE_URL}/healthz" | jq .
echo

echo "=== POST /api/v1/auth/register ==="
REGISTER_JSON='{"email":"demo@example.com","password":"password12","first_name":"Demo","last_name":"User"}'
curl -sS -X POST "${BASE_URL}/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "${REGISTER_JSON}" | tee /tmp/auth-register.json | jq .
TOKEN=$(jq -r '.token // empty' /tmp/auth-register.json)
echo

if [[ -z "${TOKEN}" ]]; then
  echo "=== POST /api/v1/auth/login (register may have failed — e.g. user exists) ==="
  LOGIN_JSON='{"email":"demo@example.com","password":"password12"}'
  curl -sS -X POST "${BASE_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "${LOGIN_JSON}" | tee /tmp/auth-login.json | jq .
  TOKEN=$(jq -r '.token // empty' /tmp/auth-login.json)
  echo
fi

if [[ -z "${TOKEN}" ]]; then
  echo "No token — fix register/login and re-run."
  exit 1
fi

echo "=== GET /api/v1/auth/me (Bearer) ==="
curl -sS "${BASE_URL}/api/v1/auth/me" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
echo

echo "=== GET /api/v1/example/protected/ping ==="
curl -sS "${BASE_URL}/api/v1/example/protected/ping" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
echo
