import { DEFAULT_PRICE } from '../runtime-config';
import type { Stock } from '../types/order.models';

/** Where the effective per-share price came from (architecture doc). */
export type PriceSource = 'INPUT' | 'DEFAULT';

/** Effective price for one stock line after applying defaulting rules. */
export interface ResolvedStockPrice {
  price: number;
  priceSource: PriceSource;
}

/**
 * Resolves the effective USD price for one stock.
 *
 * Pure: no I/O, no mutation. Uses the immutable {@link DEFAULT_PRICE} from runtime config.
 *
 * - Partner-supplied finite `price` **> 0** → that value, `INPUT`.
 * - Missing, non-finite, or **≤ 0** → {@link DEFAULT_PRICE}, `DEFAULT`.
 *
 * HTTP validation normally rejects `price <= 0` when the field is present; this branch still
 * exists so downstream logic and unit tests stay explicit.
 */
export function resolveStockPrice(stock: Stock): ResolvedStockPrice {
  const p = stock.price;
  if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
    return { price: p, priceSource: 'INPUT' };
  }
  return { price: DEFAULT_PRICE, priceSource: 'DEFAULT' };
}
