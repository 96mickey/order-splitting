/**
 * Idempotency + in-flight deduplication for `POST /orders/split`.
 *
 * - **`begin`**: acquire `executing` slot, or `replay` / `in_progress` / `conflict`.
 * - **`complete`**: promote `executing` → `complete` with TTL; LRU evicts **complete** entries only.
 * - **`abort`**: drop stuck `executing` (handler error or stale takeover).
 *
 * Stale `executing` (default 3m) is cleared on `begin` so a crashed request does not block the key
 * forever (rare risk of double execution if the first request is still running elsewhere).
 */

const DEFAULT_MAX_COMPLETE_ENTRIES = 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_EXECUTING_MS = 3 * 60 * 1000;
/** Run full expired-complete purge every N `begin` calls (amortized vs every request). */
const DEFAULT_PURGE_EVERY_N_BEGINS = 32;

type ExecutingEntry = {
  kind: 'executing';
  fingerprint: string;
  startedAtMs: number;
};

type CompleteEntry = {
  kind: 'complete';
  fingerprint: string;
  response: unknown;
  expiresAtMs: number;
};

type CacheEntry = ExecutingEntry | CompleteEntry;

export type IdempotencyBeginResult =
  | { status: 'acquired' }
  | { status: 'replay'; response: unknown }
  | { status: 'in_progress' }
  | { status: 'conflict' };

export type IdempotencyStoreOptions = {
  maxCompleteEntries?: number;
  completeTtlMs?: number;
  staleExecutingMs?: number;
  /** Defaults to 32. Set to 1 to purge on every begin (legacy behavior). */
  purgeEveryNBegins?: number;
};

export class IdempotencyStore {
  private readonly maxCompleteEntries: number;

  private readonly completeTtlMs: number;

  private readonly staleExecutingMs: number;

  private readonly purgeEveryNBegins: number;

  /** Insertion order = LRU for complete entries; executing entries may appear anywhere. */
  private readonly cache = new Map<string, CacheEntry>();

  private beginsSincePurge = 0;

  constructor(options: IdempotencyStoreOptions = {}) {
    this.maxCompleteEntries = options.maxCompleteEntries ?? DEFAULT_MAX_COMPLETE_ENTRIES;
    this.completeTtlMs = options.completeTtlMs ?? TWENTY_FOUR_HOURS_MS;
    this.staleExecutingMs = options.staleExecutingMs ?? DEFAULT_STALE_EXECUTING_MS;
    this.purgeEveryNBegins = options.purgeEveryNBegins ?? DEFAULT_PURGE_EVERY_N_BEGINS;
  }

  private countComplete(): number {
    return [...this.cache.values()].filter((v) => v.kind === 'complete').length;
  }

  /** Drop expired `complete` entries (lazy GC). */
  private purgeExpiredComplete(now: number): void {
    [...this.cache.entries()].forEach(([k, v]) => {
      if (v.kind === 'complete' && now > v.expiresAtMs) {
        this.cache.delete(k);
      }
    });
  }

  /** Evict least-recently-inserted **complete** entries until under cap. */
  private evictCompleteLruIfNeeded(): void {
    let over = this.countComplete() - this.maxCompleteEntries;
    if (over <= 0) return;
    [...this.cache.keys()].forEach((k) => {
      if (over <= 0) return;
      const v = this.cache.get(k);
      if (v?.kind === 'complete') {
        this.cache.delete(k);
        over -= 1;
      }
    });
  }

  begin(key: string, fingerprint: string): IdempotencyBeginResult {
    const now = Date.now();
    this.beginsSincePurge += 1;
    if (this.beginsSincePurge >= this.purgeEveryNBegins) {
      this.beginsSincePurge = 0;
      this.purgeExpiredComplete(now);
    }

    const existing = this.cache.get(key);

    if (existing?.kind === 'executing') {
      if (now - existing.startedAtMs > this.staleExecutingMs) {
        this.cache.delete(key);
        return this.begin(key, fingerprint);
      }
      return { status: 'in_progress' };
    }

    if (existing?.kind === 'complete') {
      if (now > existing.expiresAtMs) {
        this.cache.delete(key);
        return this.begin(key, fingerprint);
      }
      if (existing.fingerprint !== fingerprint) {
        return { status: 'conflict' };
      }
      return { status: 'replay', response: existing.response };
    }

    this.cache.set(key, {
      kind: 'executing',
      fingerprint,
      startedAtMs: now,
    });
    return { status: 'acquired' };
  }

  complete(key: string, response: unknown): void {
    const existing = this.cache.get(key);
    if (existing?.kind !== 'executing') {
      return;
    }
    this.cache.delete(key);
    this.cache.set(key, {
      kind: 'complete',
      fingerprint: existing.fingerprint,
      response,
      expiresAtMs: Date.now() + this.completeTtlMs,
    });
    this.evictCompleteLruIfNeeded();
  }

  /** Remove in-flight slot (e.g. handler threw before `complete`). */
  abort(key: string): void {
    const existing = this.cache.get(key);
    if (existing?.kind === 'executing') {
      this.cache.delete(key);
    }
  }

  /** @internal Vitest isolation */
  clearForTests(): void {
    this.cache.clear();
    this.beginsSincePurge = 0;
  }
}

export const idempotencyStore = new IdempotencyStore();
