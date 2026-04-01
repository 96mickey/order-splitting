# Order Splitter (domain)

Core **business logic** for splitting orders: validation, pricing resolution, execution timing, in-memory stores, and idempotency fingerprinting.

| Area | Location |
|------|-----------|
| Types | `types/order.models.ts` |
| Validation | `validation/split-order.validator.ts`, `validation/decimal-precision.ts` |
| Split engine | `split/split-order-engine.ts` |
| Stores | `stores/order-store.ts`, `stores/idempotency-store.ts` |
| Timing | `timing/market-execution-timing.ts` (Luxon) |
| Runtime config | `runtime-config.ts` |
| Errors | `errors/` |

HTTP wiring lives under **`api/`** (routes → controllers → services). End-to-end behaviour is covered in **`tests/order-splitter/`**. For how to call the API, see the root **[`README.md`](../README.md)** and **[`postman/README.md`](../postman/README.md)**.

For requirement wording on **flexible portfolios** and **BUY/SELL**, see **[`docs/flexible-portfolios-buy-sell.md`](../docs/flexible-portfolios-buy-sell.md)**.
