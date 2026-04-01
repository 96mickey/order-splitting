import type { OrderRequest } from '../types/order.models';
import { resolveStockPrice, type PriceSource } from '../pricing/resolve-stock-price';

/** One row in the split breakdown returned to clients. */
export interface SplitLineBreakdown {
  symbol?: string;
  weight: number;
  /** Dollar amount allocated to this line before quantity flooring: `totalAmount × (weight / 100)`. */
  allocatedAmount: number;
  /** Effective price from the price resolver. */
  price: number;
  priceSource: PriceSource;
  /** Shares/units after flooring to `maxDecimalPlaces` (never rounded up). */
  quantity: number;
  /** Cash spent on this line: `quantity × price`. */
  actualCost: number;
}

export interface SplitOrderEngineResult {
  lines: SplitLineBreakdown[];
  /** Leftover cash when floored quantities under-spend the notional (`totalAmount − Σ actualCost`). */
  cashBalance: number;
}

/**
 * Computes how many **whole units at `decimalPlaces` resolution** you can buy for a dollar
 * allocation, using **floor only** (never `Math.round` / banker's rounding).
 *
 * ### Formula (equivalent forms)
 * - Conceptual: `⌊ (allocatedAmount ÷ price) × 10ⁿ ⌋ ÷ 10ⁿ` where `n = decimalPlaces`.
 * - Implementation: `⌊ (allocatedAmount × 10ⁿ) ÷ price ⌋ ÷ 10ⁿ`
 *
 * We multiply **allocated** by `10ⁿ` *before* dividing by **price**, then `Math.floor`, then
 * scale back. That is algebraically the same as flooring the ratio first, but tends to behave
 * slightly better with IEEE-754 (e.g. repeating decimals like ⅓).
 *
 * ### Why floor?
 * Partners get **at most** their allocated notional in shares; any fractional tail that does not
 * fit a whole step at `n` decimals is **dropped**, not rounded up. Leftover cash surfaces as
 * {@link SplitOrderEngineResult.cashBalance} at the order level.
 *
 * @param allocatedAmount — Dollar amount assigned to this line (e.g. `$60` on a `$100` order
 *   with a `60%` weight).
 * @param price — Positive price per share/unit (from the price resolver).
 * @param decimalPlaces — `n`, how many digits after the decimal are kept in **quantity**
 *   (must match runtime `maxDecimalPlaces`, integer `0…10`).
 *
 * @returns Quantity floored to `n` decimal places.
 *
 * @throws {RangeError} If amounts are not finite, `price <= 0`, or `decimalPlaces` is invalid.
 *
 * @example Simple split with 3 decimals
 * ```ts
 * // $60 allocated, $100/share → 0.6 shares exactly
 * flooredQuantity(60, 100, 3); // → 0.6
 * ```
 *
 * @example Floor vs round (spec acceptance)
 * ```ts
 * // $100 allocated, $150/share → exact ratio 2/3 = 0.666666…
 * flooredQuantity(100, 150, 3); // → 0.666  (floor)
 * // A naive round to 3dp would be 0.667 — we never do that here.
 * ```
 *
 * @example Whole shares only (`n = 0`)
 * ```ts
 * flooredQuantity(99, 50, 0); // → 1  (⌊99/50⌋)
 * ```
 */
export function flooredQuantity(allocatedAmount: number, price: number, decimalPlaces: number): number {
  if (!Number.isFinite(allocatedAmount) || !Number.isFinite(price) || price <= 0) {
    throw new RangeError('flooredQuantity requires finite allocatedAmount and finite price > 0');
  }
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 10) {
    throw new RangeError('decimalPlaces must be an integer from 0 to 10');
  }
  const factor = 10 ** decimalPlaces;
  return Math.floor((allocatedAmount * factor) / price) / factor;
}

/**
 * **Splitting engine:** turns a validated {@link OrderRequest} into per-line allocations,
 * floored quantities, spend, and remaining **cash balance**.
 *
 * ### Pipeline (each stock line)
 * 1. **Allocate** — `allocatedAmount = totalAmount × (weight ÷ 100)` (weight is a percent).
 * 2. **Price** — {@link resolveStockPrice}: partner `INPUT` or config `DEFAULT`.
 * 3. **Quantity** — {@link flooredQuantity}(allocatedAmount, price, `maxDecimalPlaces`).
 * 4. **Spend** — `actualCost = quantity × price`.
 *
 * Then:
 * - `cashBalance = totalAmount − Σ actualCost` across all lines.
 *
 * Flooring quantities almost always **under-spends** the notional by a tiny amount (“rounding
 * dust”); that remainder is **cashBalance** (≥ 0 in exact arithmetic; may differ by ~ε in
 * floating point).
 *
 * ### Purity / config
 * The function is **pure** for a given `(order, maxDecimalPlaces)` pair: no global reads.
 * HTTP handlers should pass `getConfigSnapshot().maxDecimalPlaces` so quantity precision
 * follows `PATCH /config`.
 *
 * @param order — Validated request (`stocks` non-empty, weights sum ~100%, amounts/prices legal).
 *   `orderType` is ignored for math today; only echoed by the API.
 * @param maxDecimalPlaces — Same `n` as in {@link flooredQuantity} (integer `0…10`).
 *
 * @returns `{ lines, cashBalance }` — one {@link SplitLineBreakdown} per stock, in input order.
 *
 * @throws {RangeError} If `maxDecimalPlaces` is invalid or `totalAmount` is not finite.
 *
 * @example $100 order, 60% / 40%, default $100/share, 3dp (acceptance-style)
 * ```ts
 * splitOrder(
 *   {
 *     totalAmount: 100,
 *     orderType: 'BUY',
 *     stocks: [
 *       { symbol: 'AAPL', weight: 60 }, // uses DEFAULT_PRICE 100
 *       { symbol: 'TSLA', weight: 40 },
 *     ],
 *   },
 *   3,
 * );
 * // lines[0]: quantity 0.6,  actualCost 60
 * // lines[1]: quantity 0.4,  actualCost 40
 * // cashBalance ≈ 0
 * ```
 *
 * @example Rounding dust when many legs share one price
 * ```ts
 * // $100, three weights, all $30/share — floored qty 1.111 each → spend 99.99, dust 0.01
 * splitOrder(
 *   {
 *     totalAmount: 100,
 *     orderType: 'BUY',
 *     stocks: [
 *       { weight: 33.33, price: 30 },
 *       { weight: 33.33, price: 30 },
 *       { weight: 33.34, price: 30 },
 *     ],
 *   },
 *   3,
 * );
 * // cashBalance ≈ 0.01
 * ```
 */
export function splitOrder(order: OrderRequest, maxDecimalPlaces: number): SplitOrderEngineResult {
  if (!Number.isInteger(maxDecimalPlaces) || maxDecimalPlaces < 0 || maxDecimalPlaces > 10) {
    throw new RangeError('maxDecimalPlaces must be an integer from 0 to 10');
  }
  const { totalAmount, stocks } = order;
  if (!Number.isFinite(totalAmount)) {
    throw new RangeError('totalAmount must be finite');
  }

  const lines: SplitLineBreakdown[] = stocks.map((stock) => {
    const allocatedAmount = totalAmount * (stock.weight / 100);
    const { price, priceSource } = resolveStockPrice(stock);
    const quantity = flooredQuantity(allocatedAmount, price, maxDecimalPlaces);
    const actualCost = quantity * price;
    return {
      ...(stock.symbol !== undefined ? { symbol: stock.symbol } : {}),
      weight: stock.weight,
      allocatedAmount,
      price,
      priceSource,
      quantity,
      actualCost,
    };
  });

  const totalActual = lines.reduce((sum, line) => sum + line.actualCost, 0);
  const cashBalance = totalAmount - totalActual;

  return { lines, cashBalance };
}
