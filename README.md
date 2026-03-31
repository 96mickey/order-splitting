# Auth starter — production-ready TypeScript API template

A **Node.js + Express** service template with **PostgreSQL (Sequelize)**, **JWT authentication (Passport)**, optional **Redis**, **structured logging**, **security middleware**, and **operational hooks** suitable as a base for auth or other small microservices.

---

## Table of contents

1. [What you get](#what-you-get)
2. [Tech stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Repository layout](#repository-layout)
5. [Environment variables](#environment-variables)
6. [Setup and run](#setup-and-run)
7. [Scripts](#scripts)
8. [API overview](#api-overview)
9. [Production-oriented features](#production-oriented-features)
10. [Logging and correlation IDs](#logging-and-correlation-ids)
11. [Testing](#testing)
12. [Postman and cURL](#postman-and-curl)
13. [Sample seeded users](#sample-seeded-users)
14. [Troubleshooting](#troubleshooting)

---

## What you get

| Area | Details |
|------|---------|
| **Auth** | Register, login, JWT access token, `GET /me` with Passport JWT |
| **Health** | `GET /healthz` — process up |
| **Readiness** | `GET /readyz` — database (and Redis if enabled) |
| **Example** | Protected route demonstrating JWT middleware |
| **Data** | Sequelize models, migrations, seeders |
| **Quality** | TypeScript (strict), ESLint, Vitest e2e tests |

---

## Tech stack

- **Runtime**: Node.js **18+**
- **Language**: TypeScript (**strict**)
- **HTTP**: Express 4
- **ORM**: Sequelize 6 + **PostgreSQL** (`pg`) or **SQLite** (e.g. tests)
- **Auth**: Passport JWT, `jsonwebtoken`, `bcrypt`
- **Validation**: Celebrate + Joi
- **Optional cache/session prep**: **ioredis** (Redis client)
- **Logging**: Winston + daily rotate file transports
- **Security**: Helmet, CORS, express-rate-limit
- **Tests**: Vitest + Supertest

---

## Prerequisites

- **Node.js** 18 or newer and **npm**
- **PostgreSQL** running locally or remotely (for normal development with `DATABASE_DIALECT=postgres`)
- **Redis** only if you set `REDIS_ENABLED=true` (otherwise the app skips Redis; readiness reflects that)

---

## Repository layout

```
├── api/                    # HTTP layer
│   ├── controllers/        # Route handlers
│   ├── helpers/            # Shared helpers (e.g. auth DTOs)
│   ├── middlewares/        # auth, error, request-context, http logging
│   ├── routes/             # Routers (v1 API)
│   ├── utils/              # APIError, etc.
│   ├── validations/        # Celebrate/Joi schemas
│   └── logging/            # appLog + re-exports for manual logging
├── config/                 # App wiring: express, passport, vars, logger, redis, rate-limit, sequelize
├── db/
│   ├── migrations/         # Sequelize migrations
│   ├── models/             # User, Role + Sequelize setup
│   └── seeders/            # Sample roles/users
├── types/                  # Domain types, Express augmentation, errors, JWT, logging
├── tests/                  # Vitest setup + e2e tests
├── index.ts                # Bootstrap: DB/Redis, HTTP server, graceful shutdown
├── config/database.ts      # sequelize-cli config (TS)
└── .env.example            # Required keys (validated by dotenv-safe)
```

**Separation of concerns**: transport (`api/`), infrastructure (`config/`), persistence (`db/`), shared typing (`types/`), verification (`tests/`).

---

## Environment variables

Configuration is loaded in **`config/vars.ts`** (and **`config/database.ts`** for CLI). The repo uses **`dotenv-safe`**: every key listed in **`.env.example`** must exist in your **`.env`** (values may be empty where allowed).

### Core

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` / `test` / `production` |
| `PORT` | HTTP listen port (default `3010`) |
| `TRUST_PROXY` | Set `true` behind a reverse proxy so `req.ip` and rate limits use `X-Forwarded-For` correctly |

### Database (Sequelize)

| Variable | Purpose |
|----------|---------|
| `DATABASE_DIALECT` | `postgres` or `sqlite` |
| `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | Connection |
| `DATABASE_HOST`, `DATABASE_PORT` | Postgres host/port |
| `DATABASE_STORAGE` | SQLite file or `:memory:` |
| `SQL_LOGGING` | `true` to print SQL to console |

### JWT and passwords

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing secret (**change in production**) |
| `JWT_EXPIRATION_MINUTES` | Access token lifetime |
| `JWT_ISSUER`, `JWT_AUDIENCE` | JWT claims |
| `BCRYPT_ROUNDS` | Cost factor for password hashing |
| `DEFAULT_ROLE_NAME` | Role assigned on register if not specified |

### CORS

| Variable | Purpose |
|----------|---------|
| `CORS_ENABLED` | Master switch |
| `CORS_ORIGIN` | `*` or comma-separated origins |
| `CORS_CREDENTIALS` | Allow credentials |

### Rate limiting

| Variable | Purpose |
|----------|---------|
| `RATE_LIMIT_ENABLED` | Master switch |
| `RATE_LIMIT_SCOPE` | `global` (all routes) or `api` (only `/api`) |
| `RATE_LIMIT_WINDOW_MS` | Window size |
| `RATE_LIMIT_MAX` | Max requests per IP per window |

Health endpoints **`/healthz`** and **`/readyz`** are excluded from rate-limit counting.

### Redis (optional)

| Variable | Purpose |
|----------|---------|
| `REDIS_ENABLED` | `false` skips connection; readiness reports `disabled` |
| `REDIS_URL` | Optional single URL (overrides host/port when set) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` | Connection |
| `REDIS_KEY_PREFIX` | Key namespace prefix |

### Logging

| Variable | Purpose |
|----------|---------|
| `SERVICE_NAME` | Appears in log `defaultMeta` |
| `LOG_LEVEL` | Winston level (`error`, `warn`, `info`, `debug`, …) |
| `LOG_DIR` | Directory for rotated log files |
| `LOG_PRETTY_CONSOLE` | Human-readable console in dev |
| `LOG_HTTP_BODY` | Include redacted JSON body in HTTP access logs |
| `LOG_HTTP_HEADERS` | Include sanitized headers in HTTP access logs |

Copy the example file and edit:

```bash
cp .env.example .env
```

---

## Setup and run

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit **`.env`**: set PostgreSQL credentials and a strong **`JWT_SECRET`** for anything beyond local dev.

### 3. Create the database

Create an empty database matching **`DATABASE_NAME`** in PostgreSQL (e.g. `createdb auth_starter` or via your host’s UI).

### 4. Run migrations and seeds

```bash
npm run migrate
npm run seed
```

Migrations live under **`db/migrations`**; seeders under **`db/seeders`**. Sequelize CLI is configured via **`.sequelizerc`** to use **`config/database.ts`**.

### 5. Development server (TypeScript, watch)

```bash
npm run dev
```

The service listens on **`PORT`** (default **3010**). Startup order:

1. Connect **PostgreSQL** (Sequelize `authenticate`)
2. Connect **Redis** if `REDIS_ENABLED=true`
3. Register Passport / models (`config/sequelize.ts` side effects)
4. Load Express app (`config/express.ts`)
5. Listen and register **graceful shutdown** on `SIGTERM` / `SIGINT`

### 6. Production-style run (compiled JS)

```bash
npm run build
npm start
```

This runs **`node dist/index.js`**. Ensure **`.env`** is present in the working directory (or inject env via your orchestrator).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | `tsx watch index.ts` — hot reload |
| `npm run build` | `tsc` compile to **`dist/`** |
| `npm start` | `node dist/index.js` |
| `npm run lint` | ESLint on `*.ts` |
| `npm test` | Vitest e2e tests |
| `npm run migrate` | Run Sequelize migrations |
| `npm run migrate:undo` | Undo last migration |
| `npm run seed` | Run seeders |
| `npm run seed:undo` | Undo seeders |

---

## API overview

Base path for versioned routes is under **`/api/v1`** (see **`api/routes/v1/index.ts`**).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/healthz` | No | Liveness |
| `GET` | `/readyz` | No | Readiness (DB + optional Redis) |
| `POST` | `/api/v1/auth/register` | No | Register user |
| `POST` | `/api/v1/auth/login` | No | Login, returns JWT |
| `GET` | `/api/v1/auth/me` | JWT | Current user |
| `GET` | `/api/v1/example/protected/ping` | JWT | Example protected route |

Send JWT as **`Authorization: JWT <token>`** (Passport-JWT extractor used in this template).

---

## Production-oriented features

This section explains what was curated for **safer defaults** and **operability**; tune flags per environment.

### Security

- **Helmet** — Sets security-related HTTP headers.
- **CORS** — Env-driven; restrict **`CORS_ORIGIN`** in production (avoid `*` when using credentials).
- **Rate limiting** — IP-based (`express-rate-limit`); scope either **global** or **API-only**; configurable window and max; health routes skipped.
- **Trust proxy** — Enable **`TRUST_PROXY`** when the app sits behind nginx, a cloud load balancer, or Kubernetes ingress so client IP and rate limits stay correct.

### HTTP pipeline

Order in **`config/express.ts`** (simplified):

1. **Request context** — `X-Request-ID` + **`req.log`** (Winston child).
2. **Body parsers** — JSON / URL-encoded (size limit 10mb).
3. **HTTP access logger** — One structured line per request on response finish.
4. **Compression**, **method-override**, **Helmet**, **CORS**.
5. **Rate limit** (if enabled).
6. **Passport** JWT strategy.
7. **Routes**.
8. **Celebrate** validation error handler → **APIError** converter → **404** → **final error handler**.

### Data layer

- **Sequelize** with typed models (**`types/models.ts`**) and migrations/seeders.
- **PostgreSQL** is the default; **SQLite** suits local tests (`DATABASE_DIALECT=sqlite`, `:memory:` in tests).

### Optional Redis

- **`config/redis.ts`** connects when **`REDIS_ENABLED=true`**.
- **`/readyz`** reports Redis **up** / **down** / **disabled** so orchestrators can use the same probe semantics.

### JWT authentication

- **`config/passport.ts`** — JWT strategy; user resolved from token **`sub`**.
- Tokens issued in **`db/models/user.ts`** (`issueAccessToken`) with issuer/audience from env.

### Validation and errors

- **Celebrate** wraps routes; validation failures become **`APIError`** with 400.
- Central **error middleware** maps unknown errors, avoids leaking stacks in production responses while logging with context.

### Logging

- **Winston** root logger + **per-request child** on **`req.log`**.
- **HTTP audit** logs include correlation **`requestId`**, method, path, timing, status, optional **redacted** body and **sanitized** headers (**`config/logging-redact.ts`**).
- **Manual logs**: **`req.log.*`** in handlers; **`appLog`** from **`api/logging`** for non-HTTP code; **`getRequestLogger(req)`** when you need a logger from partial request context.

### Lifecycle

- **Graceful shutdown**: on **`SIGTERM`** / **`SIGINT`**, stop accepting connections, then **`sequelize.close()`** and **Redis quit** (if connected).

### Type safety

- Strict **TypeScript**, Express **`Request`** augmented with **`user`**, **`requestId`**, **`log`** (**`types/express.d.ts`**).

---

## Logging and correlation IDs

- **Inbound**: Accept **`X-Request-ID`** from a gateway or generate one; echo it on the response and attach to **`req.log`**.
- **Distributed systems**: The id **correlates logs inside this service**. For calls **to other services**, forward the same header (or W3C **`traceparent`** if you adopt OpenTelemetry) from your HTTP client; otherwise downstream services will generate unrelated ids.

---

## Testing

```bash
npm test
```

- **Vitest** loads **`tests/setup.ts`** (sqlite in-memory, test env vars, rate limit/logging quiet).
- E2e tests hit the real Express app and cover register → login → me → protected route and invalid login.

---

## Postman and cURL

- **Collection**: `postman/Auth-Starter.postman_collection.json`
- **cURL**: `postman/curl-examples.md` and `postman/curl-examples.sh`
- **Postman folder README**: `postman/README.md`

---

## Sample seeded users

After **`npm run seed`**:

| Email | Password | Role |
|------|----------|------|
| `demo.user@example.com` | `password12` | user |
| `admin@example.com` | `password12` | admin |

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| **`MissingEnvVarsError` (dotenv-safe)** | Every key in **`.env.example`** must exist in **`.env`** (copy from example and fill). |
| **DB connection refused** | `DATABASE_HOST` / `DATABASE_PORT`, Postgres running, database created, credentials. |
| **`/readyz` 503 — Redis** | If Redis is optional, set **`REDIS_ENABLED=false`**. If required, fix **`REDIS_*`** and ensure the server is reachable. |
| **Rate limit 429 on health checks** | Health paths are skipped by the limiter; if you still see issues, confirm middleware order matches **`config/express.ts`**. |
| **Wrong client IP behind proxy** | Set **`TRUST_PROXY=true`** and terminate TLS at the proxy. |

---

## License

Private / internal template — adjust as needed for your organization.
