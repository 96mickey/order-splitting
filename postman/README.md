# Postman / manual HTTP testing

This folder documents **every public HTTP route** on the Order Splitter service and gives copy-paste **cURL** examples aligned with the default server address **`127.0.0.1:3010`** (same as `PORT` default in `config/vars.ts`).

## Files

| File | Purpose |
|------|--------|
| [import-all-curls.txt](./import-all-curls.txt) | **One paste:** every route as a single-line `curl` (Postman **Import → Raw text**) |
| [Order-Splitter.postman_collection.json](./Order-Splitter.postman_collection.json) | **One file:** Postman **Import → File** (collection variables: `baseUrl`, `idempotencyKey`, `orderId`) |
| [curl-examples.md](./curl-examples.md) | Full route table, flow order, individual curls, Postman notes, troubleshooting |
| [curl-examples.sh](./curl-examples.sh) | Executable script: hits all endpoints in sequence (needs `curl`, `jq`, running server) |

## Quick curls (minimal)

```bash
BASE=http://127.0.0.1:3010

curl -sS "$BASE/healthz"
curl -sS "$BASE/readyz"
curl -sS "$BASE/config"
curl -sS "$BASE/orders"
curl -sS "$BASE/api/v1/example/ping"
```

**Split order** always needs an idempotency header:

```bash
curl -sS -X POST "$BASE/orders/split" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"totalAmount":100,"orderType":"BUY","stocks":[{"symbol":"AAPL","weight":60},{"symbol":"TSLA","weight":40}]}'
```

## Run all examples

```bash
# from repository root, with the API already listening
./postman/curl-examples.sh
```

Optional:

```bash
BASE=http://localhost:3010 ./postman/curl-examples.sh
IDEMPOTENCY_KEY=replay-demo-key ./postman/curl-examples.sh
```

## Import everything into Postman (one go)

**Option A — cURL (raw text)**  
1. Open [import-all-curls.txt](./import-all-curls.txt), select all, copy.  
2. Postman → **Import** → **Raw text** → paste → **Continue** → **Import**.  
3. Postman creates one request per line. Change host/port in each URL if you are not on `127.0.0.1:3010`.

**Option B — Collection file (recommended)**  
1. Postman → **Import** → **File** → choose [Order-Splitter.postman_collection.json](./Order-Splitter.postman_collection.json).  
2. Edit collection variables: **`orderId`** should match a real `orderId` from a split response (or from **GET /orders**). The default placeholder UUID will 404 until you replace it.

The two **POST /orders/split** requests share **`idempotencyKey`** so the second call demonstrates replay (**200** + `idempotencyHit`) after the first (**201**).

## Auth / legacy note

The previous **Auth starter** Postman collection was removed when JWT/auth was stripped from this codebase. This folder is the source of truth for **Order Splitter** HTTP testing.
