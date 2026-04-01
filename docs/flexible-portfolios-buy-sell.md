# Interpreting “flexible portfolios” and BUY/SELL

This note maps the requirement that the endpoint be **flexible**, support **different model portfolios**, and **BUY or SELL** to how this service is implemented.

## What the line usually means

- **Flexible design** — The split API is not tied to one fixed basket (for example, not hard-coded to a single 60/40 template). Callers supply **their own** allocation each time: how many lines, which symbols (when required by rules), weights that sum to 100% (within tolerance), optional per-line prices, and optional metadata.
- **Different model portfolios** — Typically this means **different compositions per request** (another client or another order can send a different `stocks` array and optional `portfolioId`), not necessarily a **server-maintained catalog** of named models (“Model A”, “Model B”) unless the spec says so elsewhere.
- **BUY or SELL** — The contract allows **`orderType`** to be either side; validation rejects anything else.

## How this codebase matches that

| Expectation | Where it lives |
|-------------|----------------|
| BUY / SELL only on the wire | [`order-splitter/types/order.models.ts`](../order-splitter/types/order.models.ts) (`OrderType`), enforced in [`order-splitter/validation/split-order.validator.ts`](../order-splitter/validation/split-order.validator.ts) |
| Variable portfolios (many lines, weights, optional symbol/price) | Same `OrderRequest`: `stocks: Portfolio`, optional `portfolioId` |
| Not one hard-coded portfolio | Engine is generic over `stocks[]`: [`order-splitter/split/split-order-engine.ts`](../order-splitter/split/split-order-engine.ts) |
| Echo / list behaviour includes `orderType` and `portfolioId` | For example [`api/controllers/orders.controller.ts`](../api/controllers/orders.controller.ts), list/get tests in [`tests/order-splitter/orders.list-get-config.test.ts`](../tests/order-splitter/orders.list-get-config.test.ts) |

For a **normal reading** of that requirement—“we can send different baskets and say BUY or SELL”—the implementation covers the flexible **shape** of the endpoint.

## Nuance: deeper BUY vs SELL behaviour

The split engine states that **`orderType` does not affect allocation math** today—it is **accepted, validated, stored, and echoed**, but BUY and SELL use the **same** splitting logic. See the `@param order` note in [`order-splitter/split/split-order-engine.ts`](../order-splitter/split/split-order-engine.ts).

- If reviewers only care that the **API** accepts both and stays flexible on lines/weights, that matches the current design.
- If they expect a **semantic** difference for SELL (for example proceeds, shorting, inverted sign, different rounding rules), that would be a **behavioural gap** to clarify with stakeholders or extend in the engine/service layer.

## Nuance: “model portfolios” as server-side templates

This service does **not** expose endpoints such as “list predefined models” or “split by `modelPortfolioId` that resolves to weights server-side.” Flexibility is **request-driven**: the **model** is the `stocks` array (plus optional `portfolioId` for labeling/audit). If the written spec required **registered templates** on the server, that would be missing—but that is a less common reading of a single “flexible portfolios” sentence.

## Practical limits on flexibility

- **Max number of lines** per order (`MAX_STOCKS_PER_ORDER` in [`order-splitter/constants.ts`](../order-splitter/constants.ts)) caps how large a portfolio can be in one request.
- **Weights** must sum to ~100% per validator rules; **totalAmount** and **prices** must satisfy validation.

---

**Bottom line:** The requirement is about **contract flexibility** (variable `stocks`, BUY/SELL). This project satisfies that at the **API and validation** level. Confirm with stakeholders whether **SELL** must change **math or business rules**; today it does not, by design in the engine.
