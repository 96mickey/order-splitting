import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../config/express';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import * as split from '../../order-splitter/split';
import { orderStore, resetOrderSplitterStoresForTests } from '../../order-splitter/stores';
import { stripPostMeta } from '../helpers/split-order-http';

function validSplitBody() {
  return {
    totalAmount: 10_000,
    orderType: 'BUY' as const,
    stocks: [
      { symbol: 'AAA', weight: 60, price: 12.34 },
      { symbol: 'BBB', weight: 40 },
    ],
  };
}

describe.sequential('orders idempotency + GET', () => {
  beforeEach(() => {
    resetOrderSplitterStoresForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns 400 IDEMPOTENCY_KEY_REQUIRED when header missing', async () => {
    const res = await request(app)
      .post('/orders/split')
      .send({
        totalAmount: 100,
        orderType: 'BUY',
        stocks: [{ weight: 100, price: 10 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('returns 400 when Idempotency-Key is empty after trim', async () => {
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', '   ')
      .send(validSplitBody());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('returns 400 when Idempotency-Key exceeds 256 characters', async () => {
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', `${'z'.repeat(256)}x`)
      .send(validSplitBody());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('201 then 200 replay with same orderId and meta.idempotencyHit', async () => {
    const key = randomUUID();
    const body = {
      totalAmount: 100,
      orderType: 'BUY' as const,
      stocks: [{ weight: 100, price: 10 }],
    };
    const first = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(first.body.meta).toEqual({ idempotencyHit: false });
    expect(first.body.orderId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const second = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(second.status).toBe(200);
    expect(second.body.meta).toEqual({ idempotencyHit: true });
    expect(stripPostMeta(second.body as Record<string, unknown>)).toEqual(
      stripPostMeta(first.body as Record<string, unknown>),
    );
  });

  it('replays with same fingerprint when stock rows are reordered in JSON', async () => {
    const key = randomUUID();
    const a = {
      totalAmount: 500,
      orderType: 'SELL' as const,
      stocks: [
        { symbol: 'X', weight: 40, price: 2 },
        { symbol: 'Y', weight: 60, price: 3 },
      ],
    };
    const b = {
      ...a,
      stocks: [a.stocks[1], a.stocks[0]],
    };
    const first = await request(app).post('/orders/split').set('Idempotency-Key', key).send(a);
    expect(first.status).toBe(201);
    const second = await request(app).post('/orders/split').set('Idempotency-Key', key).send(b);
    expect(second.status).toBe(200);
    expect(second.body.meta).toEqual({ idempotencyHit: true });
    expect(stripPostMeta(second.body as Record<string, unknown>)).toEqual(
      stripPostMeta(first.body as Record<string, unknown>),
    );
  });

  it('same Idempotency-Key with different body returns 409 IDEMPOTENCY_CONFLICT', async () => {
    const key = randomUUID();
    const a = {
      totalAmount: 100,
      orderType: 'BUY' as const,
      stocks: [{ weight: 100, price: 10 }],
    };
    const b = { ...a, totalAmount: 200 };
    const first = await request(app).post('/orders/split').set('Idempotency-Key', key).send(a);
    expect(first.status).toBe(201);

    const second = await request(app).post('/orders/split').set('Idempotency-Key', key).send(b);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  });

  it('409 IDEMPOTENCY_IN_PROGRESS when the same key is used while a stalled request holds the slot', async () => {
    const key = randomUUID();
    const body = validSplitBody();
    const slow = request(app)
      .post('/orders/split')
      .set('Idempotency-Key', key)
      .set('x-test-stall-ms', '400')
      .send(body);
    const fast = request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    const [slowRes, fastRes] = await Promise.all([slow, fast]);
    const statuses = [slowRes.status, fastRes.status].sort();
    expect(statuses).toEqual([201, 409]);
    const conflict = slowRes.status === 409 ? slowRes : fastRes;
    expect(conflict.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS);
  });

  it('ignores x-test-stall-ms when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const key = randomUUID();
    const start = Date.now();
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', key)
      .set('x-test-stall-ms', '2000')
      .send(validSplitBody());
    expect(res.status).toBe(201);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it('ignores invalid x-test-stall-ms values in test (non-numeric, zero, over cap)', async () => {
    const key = randomUUID();
    const start = Date.now();
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', key)
      .set('x-test-stall-ms', 'not-a-number')
      .send(validSplitBody());
    expect(res.status).toBe(201);
    expect(Date.now() - start).toBeLessThan(500);

    const key2 = randomUUID();
    const res2 = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', key2)
      .set('x-test-stall-ms', '0')
      .send(validSplitBody());
    expect(res2.status).toBe(201);

    const key3 = randomUUID();
    const res3 = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', key3)
      .set('x-test-stall-ms', '6000')
      .send(validSplitBody());
    expect(res3.status).toBe(201);
  });

  it('returns 500 when order store refuses insert (allocation failure)', async () => {
    vi.spyOn(orderStore, 'tryInsert').mockReturnValueOnce(false);
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', randomUUID())
      .send(validSplitBody());
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/unique order id/i);
  });

  it('propagates unexpected split errors as 500', async () => {
    vi.spyOn(split, 'splitOrder').mockImplementation(() => {
      throw new Error('split engine unavailable');
    });
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', randomUUID())
      .send(validSplitBody());
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/split engine unavailable/i);
  });

  it('GET /orders/:orderId returns stored split response', async () => {
    const key = randomUUID();
    const body = {
      totalAmount: 10,
      orderType: 'SELL' as const,
      stocks: [{ weight: 100, price: 5 }],
    };
    const postRes = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(postRes.status).toBe(201);
    const { orderId } = postRes.body;

    const getRes = await request(app).get(`/orders/${orderId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(stripPostMeta(postRes.body as Record<string, unknown>));
  });

  it('GET /orders/:orderId returns 404 ORDER_NOT_FOUND for unknown id', async () => {
    const res = await request(app).get(`/orders/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.ORDER_NOT_FOUND);
  });

  it('after conflict, a fresh Idempotency-Key still succeeds', async () => {
    const key = randomUUID();
    const a = {
      totalAmount: 50,
      orderType: 'BUY' as const,
      stocks: [{ weight: 100, price: 1 }],
    };
    await request(app).post('/orders/split').set('Idempotency-Key', key).send(a);
    const conflict = await request(app).post('/orders/split').set('Idempotency-Key', key).send({ ...a, totalAmount: 51 });
    expect(conflict.status).toBe(409);

    const ok = await request(app).post('/orders/split').set('Idempotency-Key', randomUUID()).send(a);
    expect(ok.status).toBe(201);
    expect(ok.body.orderId).toBeDefined();
  });

  it('accepts X-Idempotency-Key for a successful split', async () => {
    const res = await request(app)
      .post('/orders/split')
      .set('X-Idempotency-Key', randomUUID())
      .send(validSplitBody());
    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ idempotencyHit: false });
    expect(res.body.breakdown.lines.length).toBe(2);
  });
});
