import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderRequest } from '../../order-splitter/types/order.models';
import { executeSplitOrder } from '../../api/services/split-order.service';
import * as split from '../../order-splitter/split';
import { fingerprintOrderRequest } from '../../order-splitter/idempotency';
import { idempotencyStore, orderStore, resetOrderSplitterStoresForTests } from '../../order-splitter/stores';

const sampleOrder = (): OrderRequest => ({
  totalAmount: 100,
  orderType: 'BUY',
  stocks: [{ weight: 100, price: 10 }],
});

describe('executeSplitOrder', () => {
  beforeEach(() => {
    resetOrderSplitterStoresForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns success with accepted payload and completes idempotency', async () => {
    const order = sampleOrder();
    const first = await executeSplitOrder({
      idempotencyKey: 'k1',
      order,
      maxDecimalPlaces: 3,
    });
    expect(first.type).toBe('success');
    if (first.type !== 'success') {
      return;
    }
    const { payload: body } = first;
    expect(body).toMatchObject({
      status: 'accepted',
      totalAmount: 100,
      breakdown: {
        lines: expect.any(Array) as unknown[],
        cashBalance: expect.any(Number) as number,
      },
      execution: {
        type: expect.stringMatching(/^(IMMEDIATE|SCHEDULED)$/) as string,
        timestamp: expect.any(String) as string,
      },
    });
    expect(String(body.orderId)).toMatch(/^[0-9a-f-]{36}$/i);

    const replay = await executeSplitOrder({
      idempotencyKey: 'k1',
      order,
      maxDecimalPlaces: 3,
    });
    expect(replay).toEqual({ type: 'replay', payload: body });
  });

  it('returns replay when the same key was already completed', async () => {
    const order = sampleOrder();
    const first = await executeSplitOrder({
      idempotencyKey: 'reuse',
      order,
      maxDecimalPlaces: 3,
    });
    expect(first.type).toBe('success');
    const second = await executeSplitOrder({
      idempotencyKey: 'reuse',
      order,
      maxDecimalPlaces: 3,
    });
    expect(second.type).toBe('replay');
    if (first.type === 'success' && second.type === 'replay') {
      expect(second.payload).toEqual(first.payload);
    }
  });

  it('returns conflict when key is complete but fingerprint differs', async () => {
    const orderA = sampleOrder();
    const orderB = { ...orderA, totalAmount: 200 };
    await executeSplitOrder({
      idempotencyKey: 'mix',
      order: orderA,
      maxDecimalPlaces: 3,
    });
    const r = await executeSplitOrder({
      idempotencyKey: 'mix',
      order: orderB,
      maxDecimalPlaces: 3,
    });
    expect(r.type).toBe('conflict');
  });

  it('returns in_progress when a second call runs while the first is still executing', async () => {
    const order = sampleOrder();
    const p1 = executeSplitOrder({
      idempotencyKey: 'overlap',
      order,
      maxDecimalPlaces: 3,
    });
    const p2 = executeSplitOrder({
      idempotencyKey: 'overlap',
      order,
      maxDecimalPlaces: 3,
    });
    const [a, b] = await Promise.all([p1, p2]);
    const kinds = [a.type, b.type].sort();
    expect(kinds).toContain('success');
    expect(kinds).toContain('in_progress');
  });

  it('returns insert_failed and aborts idempotency when tryInsert returns false', async () => {
    vi.spyOn(orderStore, 'tryInsert').mockReturnValueOnce(false);
    const r = await executeSplitOrder({
      idempotencyKey: 'ins',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
    });
    expect(r.type).toBe('insert_failed');
    const again = await executeSplitOrder({
      idempotencyKey: 'ins',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
    });
    expect(again.type).toBe('success');
  });

  it('aborts idempotency and rethrows when splitOrder throws', async () => {
    vi.spyOn(split, 'splitOrder').mockImplementation(() => {
      throw new Error('split boom');
    });
    await expect(
      executeSplitOrder({
        idempotencyKey: 'boom',
        order: sampleOrder(),
        maxDecimalPlaces: 3,
      }),
    ).rejects.toThrow('split boom');

    const fp = fingerprintOrderRequest(sampleOrder());
    expect(idempotencyStore.begin('boom', fp).status).toBe('acquired');
  });

  it('waits testStallMs in non-production when within 1–5000ms', async () => {
    const start = Date.now();
    const r = await executeSplitOrder({
      idempotencyKey: 'stall',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
      testStallMs: 25,
    });
    expect(r.type).toBe('success');
    expect(Date.now() - start).toBeGreaterThanOrEqual(10);
  });

  it('does not use stall when testStallMs is NaN or negative', async () => {
    const spy = vi.spyOn(global, 'setTimeout');
    await executeSplitOrder({
      idempotencyKey: 'nan',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
      testStallMs: Number.NaN,
    });
    await executeSplitOrder({
      idempotencyKey: 'neg',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
      testStallMs: -10,
    });
    const longStalls = spy.mock.calls.filter((args) => typeof args[1] === 'number' && (args[1] as number) >= 100);
    expect(longStalls).toHaveLength(0);
    spy.mockRestore();
  });

  it('does not use stall when testStallMs is out of range', async () => {
    const spy = vi.spyOn(global, 'setTimeout');
    const r = await executeSplitOrder({
      idempotencyKey: 'nostall1',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
      testStallMs: 5001,
    });
    expect(r.type).toBe('success');
    const stallCalls = spy.mock.calls.filter((args) => typeof args[1] === 'number' && args[1] > 10);
    expect(stallCalls).toHaveLength(0);
    spy.mockRestore();
  });

  it('does not stall in production even when testStallMs is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const spy = vi.spyOn(global, 'setTimeout');
    await executeSplitOrder({
      idempotencyKey: 'prod',
      order: sampleOrder(),
      maxDecimalPlaces: 3,
      testStallMs: 2000,
    });
    const longStallCalls = spy.mock.calls.filter((args) => args[1] === 2000);
    expect(longStallCalls).toHaveLength(0);
    spy.mockRestore();
  });
});
