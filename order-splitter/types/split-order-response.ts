import type { SplitLineBreakdown } from '../split/split-order-engine';
import type { MarketExecutionTimingResult } from '../timing/market-execution-timing';
import type { OrderType } from './order.models';

/** Per-line split math + leftover cash (persisted and returned on POST/GET). */
export interface SplitOrderBreakdown {
  lines: SplitLineBreakdown[];
  cashBalance: number;
}

/**
 * Canonical `POST /orders/split` success body stored in {@link orderStore} and idempotency replay cache.
 * `meta` is not persisted — the HTTP layer adds it for POST responses only.
 */
export interface SplitOrderStoredResponse {
  status: 'accepted';
  orderId: string;
  totalAmount: number;
  orderType: OrderType;
  breakdown: SplitOrderBreakdown;
  execution: MarketExecutionTimingResult;
}

export interface SplitOrderResponseMeta {
  idempotencyHit: boolean;
}

/** Full JSON returned on POST (create or replay). */
export type SplitOrderPostResponse = SplitOrderStoredResponse & {
  meta: SplitOrderResponseMeta;
};
