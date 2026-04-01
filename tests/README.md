# Tests

Tests use **Vitest** (Node environment) and **Supertest** against the real Express `app` from `config/express.ts` where integration coverage is needed.

## Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once with **coverage** (v8) |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Same as `npm test` |

Coverage thresholds (**90%** lines, statements, functions, branches) apply to paths configured in [`vitest.config.ts`](../vitest.config.ts). After a run, open **`coverage/index.html`** in a browser for the HTML report.

Global setup: [`setup.ts`](setup.ts).

## Layout

| Path | Focus |
|------|--------|
| `app.e2e.test.ts` | Health, readiness, skeleton ping |
| `api/http-access-log.test.ts` | HTTP access log message and middleware |
| `api/require-idempotency-key.test.ts` | `Idempotency-Key` header enforcement |
| `api/validate-split-order-body.test.ts` | Split-order body middleware |
| `api/split-order.service.test.ts` | Split-order service layer |
| `order-splitter/*.test.ts` | Engine, validation, stores, timing, execution plan, fingerprints |
| `order-splitter/orders.integration-e2e.test.ts` | End-to-end order flows via Supertest |
| `order-splitter/orders.*.test.ts` | List/get/config, idempotency-focused cases |
| `helpers/split-order-http.ts` | Shared test helpers |

For API contracts and route list, see the root **[`README.md`](../README.md)** and **[`postman/README.md`](../postman/README.md)**.
