# Order Splitter API

TypeScript **Express** service that splits multi-stock **BUY** / **SELL** orders, applies validation and idempotency, and exposes **in-memory** order state (no database). Optional **Redis** is used only for readiness when enabled—not for persisting orders.


**** assesment related questions are ansered at the end of this file *****

---

## Documentation map

| Document | Purpose |
|----------|---------|
| **This file** | Run the project, dependencies, tests, overview |
| [`postman/README.md`](postman/README.md) | HTTP surface, **Postman setup**, API contract pointers |
| [`postman/curl-examples.md`](postman/curl-examples.md) / [`postman/curl-examples.sh`](postman/curl-examples.sh) | Copy-paste **cURL** examples |
| [`tests/README.md`](tests/README.md) | How tests are organised and how to run them |
| [`order-splitter/README.md`](order-splitter/README.md) | Domain modules (engine, stores, validation) |
| [`docs/flexible-portfolios-buy-sell.md`](docs/flexible-portfolios-buy-sell.md) | How “flexible portfolios” and BUY/SELL map to this implementation |
| [`.env.example`](.env.example) | All environment variables with comments |

---

## Prerequisites

- **Node.js 18+** (see `engines` in [`package.json`](package.json))
- **Redis** only if `REDIS_ENABLED=true` in `.env`

---

## Start the project

1. Copy environment template (required keys are validated by `dotenv-safe`):

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. **Development** (watch mode, default port **3010**):

   ```bash
   npm run dev
   ```

4. **Production-style** (compile then run):

   ```bash
   npm run build
   npm start
   ```

Confirm the process is up:

```bash
curl -s http://127.0.0.1:3010/healthz
```

You should see JSON like `{"status":"ok"}`. HTTP access lines (including **`latency=…ms`**) are logged via Winston to the console when `LOG_LEVEL` is **`info`** or lower—see [`.env.example`](.env.example).

---

## Execution & request examples

Full **cURL** scripts and a tabular route list live under **`postman/`**—start with [`postman/README.md`](postman/README.md) and [`postman/curl-examples.md`](postman/curl-examples.md). To exercise orders from the shell:

```bash
BASE=http://127.0.0.1:3010

curl -s "$BASE/orders"

curl -sS -X POST "$BASE/orders/split" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen | tr '[:upper:]' '[:lower:]')" \
  -d '{
    "totalAmount": 100,
    "orderType": "BUY",
    "stocks": [
      { "symbol": "AAPL", "weight": 60 },
      { "symbol": "TSLA", "weight": 40 }
    ]
  }'
```

`POST /orders/split` returns **201** on first create and **200** on idempotent replay (same `Idempotency-Key` and body). Use the returned `orderId` with `GET /orders/:orderId`.

**Postman (GUI):** step-by-step collection and environment setup is in [`postman/README.md`](postman/README.md#testing-with-postman).

---

## Framework & library dependencies

Runtime and tooling choices are aligned with a small, reviewable Node service: standard HTTP stack, explicit validation, structured logs, and tests that hit the real Express app.

### Runtime (`dependencies`)

| Package | Role |
|---------|------|
| **express** | HTTP server and routing |
| **body-parser** | Request body parsing (JSON / urlencoded) |
| **celebrate** + **joi** | Declarative schema validation on routes (e.g. `PATCH /config`) |
| **http-status** | Consistent HTTP status constants |
| **helmet** | Security-related HTTP headers |
| **cors** | Configurable cross-origin access |
| **compression** | Response compression |
| **express-rate-limit** | Rate limiting (global or API-scoped) |
| **method-override** | HTTP method override header support |
| **dotenv-safe** | Load `.env` and fail fast if required keys are missing vs `.env.example` |
| **winston** + **winston-daily-rotate-file** | Structured logging, console + rotating files (configurable) |
| **ioredis** | Optional Redis client for readiness |
| **luxon** | Time zones and scheduling logic (**America/New_York** where applicable) |

### Development (`devDependencies`)

| Package | Role |
|---------|------|
| **typescript** | Static typing |
| **tsx** | Fast TypeScript execution in dev (`npm run dev`) |
| **vitest** + **@vitest/coverage-v8** | Unit and integration tests with coverage |
| **supertest** | HTTP assertions against Express without a live port |
| **eslint** (+ Airbnb base, TypeScript plugins) | Linting |
| **@types/\*** | TypeScript types for Node and libraries |

---

## Tests

```bash
npm test              # Vitest, all tests, coverage (see vitest.config.ts)
npm run test:watch    # Watch mode while developing
npm run test:coverage # Same as npm test (explicit alias)
```

Coverage targets **90%** lines/statements/functions/branches for selected `order-splitter` and order-related API paths; HTML report is generated under **`coverage/`** after a run with coverage enabled.

Details and file layout: [`tests/README.md`](tests/README.md).

Other scripts:

```bash
npm run lint          # ESLint on .ts sources
npm run profile:split # Optional latency profiling script (see scripts/)
```

---

## Configuration

See **[`.env.example`](.env.example)** for every variable. Highlights:

- **`PORT`** — listen port (default `3010`)
- **`REDIS_ENABLED`** — `false` for local runs without Redis
- **`LOG_LEVEL`** — use **`info`** or lower so successful requests still log access latency
- **`CORS_*`**, **`RATE_LIMIT_*`**, **`LOG_*`** — production-oriented toggles

---

## Project layout

```
api/              # Routes, controllers, middlewares, services, validations
config/           # Express app, env vars, logger, Redis, rate limit
order-splitter/   # Domain: engine, stores, validation (see order-splitter/README.md)
postman/          # API notes, Postman guide, cURL examples
scripts/          # Optional tooling (e.g. profiling)
tests/            # Vitest + Supertest (see tests/README.md)
types/            # Express augmentation, shared TS types
index.ts          # Bootstrap: Redis (optional) → listen → graceful shutdown
```

Architectural background (if present in the repo): **`architecture_doc.pdf`**.

---

## Submission checklist

- [ ] `.env` created from `.env.example`; app starts with `npm run dev` or `npm start` after `npm run build`
- [ ] `npm test` and `npm run lint` pass
- [ ] Reviewers can follow **`postman/`** for HTTP examples and Postman setup
