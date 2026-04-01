import { createHash } from 'crypto';
import type { OrderRequest, Stock } from '../types/order.models';

/** Deterministic key order for nested objects. */
function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((out, k) => ({ ...out, [k]: obj[k] }), {});
}

/** Canonical stock row for fingerprinting (sorted fields). */
function canonicalStock(s: Stock): Record<string, unknown> {
  const row: Record<string, unknown> = { weight: s.weight };
  if (s.symbol !== undefined) {
    row.symbol = s.symbol;
  }
  if (s.price !== undefined) {
    row.price = s.price;
  }
  return sortObjectKeys(row);
}

/**
 * Stable SHA-256 fingerprint of a validated order (order type, amount, stocks with sorted keys and rows).
 */
export function fingerprintOrderRequest(order: OrderRequest): string {
  const stocks = [...order.stocks]
    .map(canonicalStock)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  const payload = sortObjectKeys({
    orderType: order.orderType,
    totalAmount: order.totalAmount,
    stocks,
  });

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
