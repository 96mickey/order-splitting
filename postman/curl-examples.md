# cURL — Order Splitter + skeleton

```bash
BASE=http://127.0.0.1:3010

# Ops
curl -s "$BASE/healthz"
curl -s "$BASE/readyz"
curl -s "$BASE/api/v1/example/ping"

# Orders (Idempotency-Key required on split)
curl -s "$BASE/orders"
curl -sS -X POST "$BASE/orders/split" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen | tr '[:upper:]' '[:lower:]')" \
  -d '{"totalAmount":100,"orderType":"BUY","stocks":[{"symbol":"AAPL","weight":60},{"symbol":"TSLA","weight":40}]}'
# Replace ORDER_ID with the value from the POST response:
# curl -s "$BASE/orders/ORDER_ID"
```
