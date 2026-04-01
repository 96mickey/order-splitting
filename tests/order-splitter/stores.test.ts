import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderRequest } from '../../order-splitter/types/order.models';
import { IdempotencyStore, OrderStore } from '../../order-splitter/stores';

const sampleRequest = (): OrderRequest => ({
  totalAmount: 1,
  orderType: 'BUY',
  stocks: [{ weight: 100, price: 10 }],
});

const sampleResponse = (id: string): Record<string, unknown> => ({
  status: 'accepted',
  orderId: id,
  totalAmount: 1,
  orderType: 'BUY',
  breakdown: { lines: [], cashBalance: 0 },
  execution: { type: 'IMMEDIATE', timestamp: '2025-01-15T14:30:00.000-05:00' },
});

describe('OrderStore', () => {
  it('acceptance: after 3 tryInsert, listAll returns 3', () => {
    const store = new OrderStore();
    const t = new Date().toISOString();
    expect(store.tryInsert({ id: 'a', request: sampleRequest(), response: sampleResponse('a'), createdAt: t })).toBe(true);
    expect(store.tryInsert({ id: 'b', request: sampleRequest(), response: sampleResponse('b'), createdAt: t })).toBe(true);
    expect(store.tryInsert({ id: 'c', request: sampleRequest(), response: sampleResponse('c'), createdAt: t })).toBe(true);
    expect(store.listAll()).toHaveLength(3);
  });

  it('acceptance: getById with unknown id returns null', () => {
    const store = new OrderStore();
    const t = new Date().toISOString();
    expect(
      store.tryInsert({ id: 'only-one', request: sampleRequest(), response: sampleResponse('only-one'), createdAt: t }),
    ).toBe(true);
    expect(store.getById('missing')).toBeNull();
  });

  it('tryInsert returns false for duplicate id (immutable)', () => {
    const store = new OrderStore();
    const t = new Date().toISOString();
    const row = { id: 'x', request: sampleRequest(), response: sampleResponse('x'), createdAt: t };
    expect(store.tryInsert(row)).toBe(true);
    expect(store.tryInsert({ ...row, response: { ...sampleResponse('x'), mutated: true } })).toBe(false);
    expect(store.listAll()).toHaveLength(1);
    expect(store.getById('x')?.response).toEqual(sampleResponse('x'));
  });
});

describe('IdempotencyStore', () => {
  it('evicts oldest complete when capacity exceeded', () => {
    const store = new IdempotencyStore({ maxCompleteEntries: 1000, completeTtlMs: 3_600_000 });
    for (let i = 0; i < 1000; i += 1) {
      expect(store.begin(`k${i}`, 'fp').status).toBe('acquired');
      store.complete(`k${i}`, { n: i });
    }
    expect(store.begin('k_new', 'fp').status).toBe('acquired');
    store.complete('k_new', { fresh: true });
    expect(store.begin('k0', 'fp').status).toBe('acquired');
  });

  it('replay same key and fingerprint', () => {
    const store = new IdempotencyStore();
    expect(store.begin('a', 'fp1').status).toBe('acquired');
    store.complete('a', { ok: 1 });
    const r = store.begin('a', 'fp1');
    expect(r.status).toBe('replay');
    if (r.status === 'replay') expect(r.response).toEqual({ ok: 1 });
  });

  it('conflict when same key different fingerprint after complete', () => {
    const store = new IdempotencyStore();
    expect(store.begin('a', 'fp1').status).toBe('acquired');
    store.complete('a', { x: 1 });
    expect(store.begin('a', 'fp2').status).toBe('conflict');
  });

  it('in_progress when second begin before complete', () => {
    const store = new IdempotencyStore({ staleExecutingMs: 60_000 });
    expect(store.begin('a', 'fp').status).toBe('acquired');
    expect(store.begin('a', 'fp').status).toBe('in_progress');
  });

  it('abort allows second acquire', () => {
    const store = new IdempotencyStore();
    expect(store.begin('a', 'fp').status).toBe('acquired');
    store.abort('a');
    expect(store.begin('a', 'fp').status).toBe('acquired');
  });

  it('expires complete entries after TTL', () => {
    vi.useFakeTimers();
    const store = new IdempotencyStore({ maxCompleteEntries: 50, completeTtlMs: 60_000 });
    expect(store.begin('x', 'fp').status).toBe('acquired');
    store.complete('x', { v: 1 });
    expect(store.begin('x', 'fp').status).toBe('replay');
    vi.advanceTimersByTime(60_001);
    expect(store.begin('x', 'fp').status).toBe('acquired');
    vi.useRealTimers();
  });

  it('complete is a no-op when the key is missing or not executing', () => {
    const store = new IdempotencyStore();
    expect(() => store.complete('missing', { x: 1 })).not.toThrow();
    store.begin('a', 'fp');
    store.complete('a', { ok: true });
    expect(() => store.complete('a', { other: true })).not.toThrow();
    const r = store.begin('a', 'fp');
    expect(r.status).toBe('replay');
    if (r.status === 'replay') {
      expect(r.response).toEqual({ ok: true });
    }
  });

  it('abort does not remove a completed entry', () => {
    const store = new IdempotencyStore();
    store.begin('done', 'fp');
    store.complete('done', { saved: 1 });
    store.abort('done');
    expect(store.begin('done', 'fp').status).toBe('replay');
  });

  it('replaces a stale executing entry on begin', () => {
    vi.useFakeTimers();
    const store = new IdempotencyStore({ staleExecutingMs: 100 });
    expect(store.begin('stale', 'fp1').status).toBe('acquired');
    vi.advanceTimersByTime(101);
    expect(store.begin('stale', 'fp2').status).toBe('acquired');
    store.complete('stale', { n: 2 });
    expect(store.begin('stale', 'fp2').status).toBe('replay');
    vi.useRealTimers();
  });

  it('re-acquires after complete entry TTL expires (delete + recursive begin)', () => {
    vi.useFakeTimers();
    const store = new IdempotencyStore({ completeTtlMs: 50, maxCompleteEntries: 100 });
    expect(store.begin('ttl', 'fp').status).toBe('acquired');
    store.complete('ttl', { saved: true });
    expect(store.begin('ttl', 'fp').status).toBe('replay');
    vi.advanceTimersByTime(51);
    expect(store.begin('ttl', 'fp2').status).toBe('acquired');
    vi.useRealTimers();
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
