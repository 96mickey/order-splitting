# Order Splitter — TypeScript service skeleton

Express **API shell** prepared for the **Order Splitter POC** (architecture in `architecture_doc.pdf`). **Auth, JWT, Passport, Sequelize, and PostgreSQL have been removed** for now; the POC will use **in-memory** state per the spec.

---

## What is in the repo today

| Piece | Role |
|--------|------|
| **Express** | HTTP server, middleware order preserved |
| **Security** | Helmet, CORS, rate limiting (configurable) |
| **Logging** | Winston, `X-Request-ID`, `req.log`, HTTP access logs, `api/logging` helpers |
| **Redis** | Optional (`ioredis`) — startup + `/readyz` |
| **Health** | `GET /healthz`, `GET /readyz` (Redis only; no DB check) |
| **Placeholder API** | `GET /api/v1/example/ping` |
| **Validation stack** | Celebrate + Joi (ready for route schemas) |
| **Tests** | Vitest + Supertest (`tests/app.e2e.test.ts`) |

---

## Prerequisites

- Node.js **18+**
- **Redis** only if `REDIS_ENABLED=true`

---

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

`dotenv-safe` requires every key in **`.env.example`** to exist in **`.env`**.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | `tsx watch index.ts` |
| `npm run build` / `npm start` | Compile to `dist/`, run `node dist/index.js` |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

---

## Environment

See **`.env.example`**. Notable flags:

- **`REDIS_ENABLED`** — `false` skips Redis (good for quick local runs).
- **`RATE_LIMIT_*`**, **`CORS_*`**, **`LOG_*`** — production-style toggles.

Default **`SERVICE_NAME`** / **`REDIS_KEY_PREFIX`** use `order-splitter`.

---

## Project layout

```
api/           # routes, controllers, middlewares, logging, utils
config/        # express, vars, logger, redis, rate-limit
db/            # empty placeholder (.gitkeep) — migrations/models removed
types/         # express augmentation, errors, logging
tests/         # e2e against Express app
index.ts       # bootstrap: Redis (optional) → listen → graceful shutdown
```

---

## Next steps (when you start the POC)

Implement per **`architecture_doc.pdf`**: in-memory order store, idempotency LRU, split/timing engines, `POST /orders/split`, `GET /orders`, `GET /orders/:orderId`, `GET/PATCH /config`, Luxon (`America/New_York`), etc. **Do not** reintroduce a database unless the spec changes.

---

## Postman / cURL

Legacy auth collections under `postman/` are **out of date**. Use:

```bash
curl -s http://127.0.0.1:3010/healthz
curl -s http://127.0.0.1:3010/api/v1/example/ping
```

Update `postman/` when you add real Order Splitter endpoints.
