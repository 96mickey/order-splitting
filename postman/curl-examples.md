# cURL examples — Order Splitter API

All routes are mounted at the **root** of the app (no `/api` prefix except the v1 example). Default listen address is **`127.0.0.1:3010`** (`PORT` in `.env` overrides).

| Method | Path | Notes |
|--------|------|--------|
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Readiness; **503** if Redis is enabled but not connected |
| GET | `/config` | Runtime config snapshot |
| PATCH | `/config` | Body: `{ "maxDecimalPlaces": <0–10 integer> }` (required field) |
| GET | `/orders` | List stored orders |
| POST | `/orders/split` | Requires **`Idempotency-Key`** or **`X-Idempotency-Key`** (1–256 chars after trim) |
| GET | `/orders/:orderId` | Single order |
| GET | `/api/v1/example/ping` | Skeleton v1 route |

---

## Import all requests into Postman at once

- **cURL:** copy the entire contents of [`import-all-curls.txt`](./import-all-curls.txt) → Postman **Import** → **Raw text** → paste → **Import** (one request per line).
- **Collection:** import [`Order-Splitter.postman_collection.json`](./Order-Splitter.postman_collection.json) as a file; set **`orderId`** after your first successful split.

---

## Environment variable (shell)

```bash
BASE=http://127.0.0.1:3010
```

---

## Flow (copy-paste)

**Liveness**

```bash
curl -sS "$BASE/healthz"
```

**Readiness**

```bash
curl -sS "$BASE/readyz"
```

**Config (read)**

```bash
curl -sS "$BASE/config"
```

**Split order (create)** — use a **new** UUID per logical create; reuse the same key + identical body for idempotent replay.

```bash
curl -sS -X POST "$BASE/orders/split" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  -d '{
    "totalAmount": 100,
    "orderType": "BUY",
    "stocks": [
      { "symbol": "AAPL", "weight": 60 },
      { "symbol": "TSLA", "weight": 40 }
    ]
  }'
```

**List orders**

```bash
curl -sS "$BASE/orders"
```

**Get one order** — substitute `ORDER_ID` from the split response (`orderId`).

```bash
curl -sS "$BASE/orders/ORDER_ID"
```

**Idempotency replay** (same header + same JSON body → **200**, `meta.idempotencyHit: true`)

```bash
curl -sS -X POST "$BASE/orders/split" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  -d '{
    "totalAmount": 100,
    "orderType": "BUY",
    "stocks": [
      { "symbol": "AAPL", "weight": 60 },
      { "symbol": "TSLA", "weight": 40 }
    ]
  }'
```

**Runtime config (patch)**

```bash
curl -sS -X PATCH "$BASE/config" \
  -H 'Content-Type: application/json' \
  -d '{"maxDecimalPlaces": 7}'
```

**Example v1 ping**

```bash
curl -sS "$BASE/api/v1/example/ping"
```

---

## Runnable script

From repo root (requires `jq`; server must be running):

```bash
chmod +x postman/curl-examples.sh
./postman/curl-examples.sh
```

Override base URL or idempotency key:

```bash
BASE=http://localhost:3010 IDEMPOTENCY_KEY=my-key ./postman/curl-examples.sh
```

---

## Postman

- Create an environment variable **`baseUrl`** = `http://127.0.0.1:3010`.
- On **POST** `/orders/split`, set header **`Idempotency-Key`** to `{{$guid}}` for new creates, or a fixed value when testing replay.
- Parse **`orderId`** from the response for **GET** `/orders/{{orderId}}`.

---

## Local testing tips

- If **`RATE_LIMIT_ENABLED`** is **true** (default), rapid requests may be throttled; set **`RATE_LIMIT_ENABLED=false`** in `.env` for manual testing.
- Split payloads must satisfy validation (weights, amounts, `BUY`/`SELL`, optional per-stock `price`, etc.); adjust the JSON as needed.

There is **no** `PUT`/`DELETE` `/config` in the current app — only **GET** and **PATCH** `/config`.
