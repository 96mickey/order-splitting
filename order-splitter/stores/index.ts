/**
 * In-memory stores for the order-splitter service (no persistence across restarts).
 *
 * - **Orders:** {@link OrderStore} / {@link orderStore}
 * - **Idempotency:** {@link IdempotencyStore} / {@link idempotencyStore}
 * - **Config:** process memory in `order-splitter/runtime-config.ts` (`getConfigSnapshot`, `setMaxDecimalPlaces`)
 */

import { idempotencyStore } from './idempotency-store';
import { orderStore } from './order-store';

export { OrderStore, orderStore } from './order-store';
export type { ExecutedOrderRecord } from './order-store';
export { IdempotencyStore, idempotencyStore } from './idempotency-store';
export type { IdempotencyBeginResult, IdempotencyStoreOptions } from './idempotency-store';

/** Clears singleton order + idempotency maps (call from test `beforeEach`). */
export function resetOrderSplitterStoresForTests(): void {
  orderStore.clearForTests();
  idempotencyStore.clearForTests();
}
