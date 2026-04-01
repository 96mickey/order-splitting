# Postman

## Submission: OpenAPI vs in-repo contracts

**Decision:** A standalone **OpenAPI/Swagger file is not strictly required** for submission if reviewers accept an API definition that lives in code and runtime validation:

- Request/response shapes: [`order-splitter/types/order.models.ts`](../order-splitter/types/order.models.ts)
- Split-order rules on the wire: [`order-splitter/validation/split-order.validator.ts`](../order-splitter/validation/split-order.validator.ts) (wired by [`api/middlewares/validate-split-order-body.ts`](../api/middlewares/validate-split-order-body.ts))
- Config body: [`api/validations/config.validation.ts`](../api/validations/config.validation.ts)
- Behaviour: integration tests under [`tests/order-splitter/`](../tests/order-splitter/)

Add **OpenAPI 3** (and keep it in sync) if the assignment or rubric explicitly asks for Swagger/OpenAPI, Postman import from spec, or a single importable document outside the repo.

## Order Splitter HTTP surface (no version prefix)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/healthz` | Liveness |
| `GET` | `/readyz` | Readiness |
| `GET` | `/orders` | List orders |
| `GET` | `/orders/:orderId` | Get one order |
| `POST` | `/orders/split` | Split order; header **`Idempotency-Key`** required (UUID) |
| `GET` | `/config` | Runtime config |
| `PATCH` | `/config` | Partial config update |
| `GET` | `/api/v1/example/ping` | Skeleton example only |

Quick checks without Postman:

```bash
curl -s http://127.0.0.1:3010/healthz
curl -s http://127.0.0.1:3010/readyz
curl -s http://127.0.0.1:3010/api/v1/example/ping
```

See [`curl-examples.md`](curl-examples.md) and [`curl-examples.sh`](curl-examples.sh) for split-order examples.

---

## Testing with Postman

1. **Start the API** from the repo root (see root [`README.md`](../README.md)): `npm run dev` (default **http://127.0.0.1:3010**).
2. In Postman, create an **Environment** (e.g. `Order Splitter local`) with variable **`base_url`** = `http://127.0.0.1:3010`.
3. Create a **Collection** (e.g. `Order Splitter`) and add requests using `{{base_url}}` as the prefix.

### Example requests

| Name | Method | URL | Headers | Body |
|------|--------|-----|---------|------|
| Health | `GET` | `{{base_url}}/healthz` | — | — |
| Ready | `GET` | `{{base_url}}/readyz` | — | — |
| List orders | `GET` | `{{base_url}}/orders` | — | — |
| Get order | `GET` | `{{base_url}}/orders/<orderId>` | — | — |
| Split order | `POST` | `{{base_url}}/orders/split` | `Content-Type: application/json`<br>**`Idempotency-Key`**: UUID (v4) | Raw JSON (see below) |
| Get config | `GET` | `{{base_url}}/config` | — | — |
| Patch config | `PATCH` | `{{base_url}}/config` | `Content-Type: application/json` | e.g. `{ "maxDecimalPlaces": 3 }` |

**Split order body** (minimal example; adjust symbols/weights):

```json
{
  "totalAmount": 100,
  "orderType": "BUY",
  "stocks": [
    { "symbol": "AAPL", "weight": 60 },
    { "symbol": "TSLA", "weight": 40 }
  ]
}
```

**Idempotency:** Use Postman’s **Pre-request Script** to set a header once per request, or reuse a fixed UUID to test replay (second identical call should return **200** with `meta.idempotencyHit: true`):

```javascript
pm.request.headers.upsert({ key: 'Idempotency-Key', value: pm.variables.replaceIn('{{$guid}}') });
```

There is **no** checked-in Postman Collection v2.1 JSON in this repo; requests are quick to add from the table above. For shell-based runs, use [`curl-examples.sh`](curl-examples.sh).
