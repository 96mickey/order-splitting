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



What was your approach (thought process)?

-   treated this as a small web service with one main job: take a dollar amount and a list of stocks with weights (like “60% here, 40% there”), check that the input makes sense, split the money across those lines using clear rules (including how to handle fractions of shares), and return a breakdown the client can use.

I split the problem in two: the HTTP layer (URLs, headers, errors, logging) and the business logic (math, validation, storing orders in memory). That way I could test the rules directly and also test the full API end-to-end. I also made retries safe by requiring an idempotency key on the main “split” call so the same request sent twice doesn’t create two different orders by accident.



What assumptions did you make?

-  Orders don’t need to survive a server restart — they live in memory on that one running process. If the app restarts, that data is gone; that matched the “no persistence” style requirement.

-  One server process — I didn’t design this slice of the app for many copies of the service sharing memory; scaling out would need shared storage later. Also for this system to handle 1M RPS, we will have to divide functions even more, like time calculation could happen in different server and update it in shared cache. Instead of our main service doing that action with every request, we can simply refer to cache and take the action(since this action is consistent for all requests. Latency related decisions could be taken for this with load testing).

-  Clients pick the portfolio each time — “different model portfolios” means they send a different list of stocks and weights per request (and can tag it with an optional portfolio id string), not that the server keeps a menu of named templates unless someone asks for that explicitly. Also we have modelled it to accept portfolio Id but for future scope we can have authentication and authorization and have user linked postfolios. This system was designed keeping in mind that this service is an internal service which other services will use to just get the calculations.

-  BUY vs SELL is allowed and checked on the request, but the splitting math is the same for both today — I assumed the requirement was mainly about supporting both labels, not two completely different formulas unless the spec said otherwise.



What challenges did you face?

- Rounding and fairness — When you split money across several stocks and floor fractional shares, tiny leftovers (“dust”) appear. Getting that consistent and testable took time.

- Idempotency — Making sure “same key + same body” returns the same result and doesn’t double-create orders, including when calls overlap, needed clear rules and tests.

- Trust but verify on input — Types in TypeScript help developers, but real requests are JSON from the network, so I needed runtime checks so bad data gets a clear error, not a crash or wrong math.

- Logging — Showing how long each request took in a way that shows up in normal logs, without drowning in noise, needed sensible defaults (e.g. log level).




If you moved this to a real production environment, what would you change?

- Data and reliability

Save orders (and idempotency records) in a real database or a shared cache so multiple servers and restarts don’t lose data or break retries.
Backups, migrations, and monitoring for that store.


- Security

Login / API keys so random people on the internet can’t place orders.

Tighter rate limits and CORS so only real frontends or partners can call the API.

Secrets (passwords, keys) in a proper secrets manager, not only in a file on disk.


- Operations

Centralized logs and metrics (errors, latency, load) so on-call can see problems.

Stricter health checks if you add a database or external price feeds.




If you used LLMs, how did you use them and how did they help?

- I used an AI assistant (for example in Cursor) as a sparring partner, not as a replacement for thinking. It helped me draft tests, outline README sections, and suggest patterns for Express middleware and error handling. I still ran the test suite, read the split logic myself, and fixed mistakes when the suggestions didn’t match how idempotency or rounding actually had to work. So it sped up boilerplate and documentation, but correctness came from my own review and the tests.