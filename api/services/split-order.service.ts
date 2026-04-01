import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import type { OrderRequest } from '../../order-splitter/types/order.models';
import type { SplitOrderStoredResponse } from '../../order-splitter/types/split-order-response';
import { fingerprintOrderRequest } from '../../order-splitter/idempotency';
import { splitOrder } from '../../order-splitter/split';
import { idempotencyStore, orderStore, type ExecutedOrderRecord } from '../../order-splitter/stores';
import { getMarketExecutionTiming } from '../../order-splitter/timing';

/**
 * Outcome of {@link executeSplitOrder} — HTTP layer maps these to status codes and JSON.
 */
export type ExecuteSplitOrderResult =
  | { type: 'replay'; payload: SplitOrderStoredResponse }
  | { type: 'success'; payload: SplitOrderStoredResponse }
  | { type: 'in_progress' }
  | { type: 'conflict' }
  | { type: 'insert_failed' };

export type ExecuteSplitOrderInput = {
  idempotencyKey: string;
  order: OrderRequest;
  maxDecimalPlaces: number;
  /**
   * Non-production only: delay after acquiring the idempotency slot (tests / manual overlap checks).
   * Ignored when `process.env.NODE_ENV === 'production'`.
   */
  testStallMs?: number;
};

/**
 * Idempotency gate + split engine + immutable order insert + idempotency completion.
 * Pure orchestration of domain stores and split logic — no Express types.
 *
 * On unexpected errors from `splitOrder` (or similar), aborts the idempotency slot and **rethrows**.
 */
export async function executeSplitOrder(input: ExecuteSplitOrderInput): Promise<ExecuteSplitOrderResult> {
  const { idempotencyKey, order, maxDecimalPlaces, testStallMs } = input;
  const fingerprint = fingerprintOrderRequest(order);
  const outcome = idempotencyStore.begin(idempotencyKey, fingerprint);

  if (outcome.status === 'replay') {
    return { type: 'replay', payload: outcome.response as SplitOrderStoredResponse };
  }
  if (outcome.status === 'in_progress') {
    return { type: 'in_progress' };
  }
  if (outcome.status === 'conflict') {
    return { type: 'conflict' };
  }

  try {
    // Yield so a concurrent same-key request can observe `in_progress` (tests / dev). Skipped in
    // production to avoid an extra event-loop turn on the hot path.
    if (process.env.NODE_ENV !== 'production') {
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }

    let stall = 0;
    if (
      process.env.NODE_ENV !== 'production'
      && testStallMs !== undefined
      && Number.isFinite(testStallMs)
      && testStallMs > 0
      && testStallMs <= 5000
    ) {
      stall = testStallMs;
    }

    if (stall > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, stall);
      });
    }

    const { lines, cashBalance } = splitOrder(order, maxDecimalPlaces);
    const execution = getMarketExecutionTiming(DateTime.utc());
    const orderId = randomUUID();

    const stored: SplitOrderStoredResponse = {
      status: 'accepted',
      orderId,
      totalAmount: order.totalAmount,
      orderType: order.orderType,
      breakdown: { lines, cashBalance },
      execution,
    };

    const record: ExecutedOrderRecord = {
      id: orderId,
      request: order,
      response: { ...stored } as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };

    if (!orderStore.tryInsert(record)) {
      idempotencyStore.abort(idempotencyKey);
      return { type: 'insert_failed' };
    }

    idempotencyStore.complete(idempotencyKey, stored);
    return { type: 'success', payload: stored };
  } catch (err) {
    idempotencyStore.abort(idempotencyKey);
    throw err;
  }
}
