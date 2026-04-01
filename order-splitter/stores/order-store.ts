import type { OrderRequest } from '../types/order.models';

/**
 * Immutable executed order snapshot (POST response body + request audit fields).
 * Insert-only: {@link OrderStore.tryInsert} never overwrites an existing `id`.
 */
export interface ExecutedOrderRecord {
  id: string;
  request: OrderRequest;
  /** Exact JSON object returned to the client on successful split. */
  response: Record<string, unknown>;
  createdAt: string;
}

/**
 * In-memory order index. Cleared on process restart; not persisted.
 *
 * Node.js runs the event loop on a single thread — mutating a `Map` from request handlers is safe
 * without locks (unlike Python `threading.Lock` around shared maps).
 */
export class OrderStore {
  private readonly byId = new Map<string, ExecutedOrderRecord>();

  /**
   * Inserts a new order. Returns `false` if `record.id` already exists (immutable — no overwrite).
   */
  tryInsert(record: ExecutedOrderRecord): boolean {
    if (this.byId.has(record.id)) {
      return false;
    }
    this.byId.set(record.id, record);
    return true;
  }

  getById(id: string): ExecutedOrderRecord | null {
    return this.byId.get(id) ?? null;
  }

  listAll(): ExecutedOrderRecord[] {
    return [...this.byId.values()];
  }

  /** @internal Vitest isolation */
  clearForTests(): void {
    this.byId.clear();
  }
}

/** Shared process-wide store (tests may instantiate `OrderStore` directly). */
export const orderStore = new OrderStore();
