/**
 * Chunk 10 + overlap with `execution_plan.pdf` §3 integration rows.
 * PDF-only validation gaps, PATCH=7 flow, and performance with console latency stats live in
 * `execution-plan.test.ts`.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../config/express';
import { MAX_STOCKS_PER_ORDER } from '../../order-splitter/constants';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import { setMaxDecimalPlaces } from '../../order-splitter/runtime-config';
import { resetOrderSplitterStoresForTests } from '../../order-splitter/stores';
import { stripPostMeta } from '../helpers/split-order-http';

const DEFAULT_DECIMALS = 3;

function postSplit() {
  return request(app).post('/orders/split').set('Idempotency-Key', randomUUID());
}

function decimalFractionalLength(n: number): number {
  const s = n.toString();
  if (!s.includes('.')) return 0;
  const [, frac] = s.split('.');
  if (frac.includes('e') || frac.includes('E')) return 0;
  return frac.replace(/0+$/, '').length;
}

/** $100 BUY 60/40 — both legs use default $100/share (no price on lines). */
function splitBodyUsd100SixtyForty() {
  return {
    totalAmount: 100,
    orderType: 'BUY' as const,
    stocks: [
      { symbol: 'AAPL', weight: 60 },
      { symbol: 'TSLA', weight: 40 },
    ],
  };
}

describe.sequential('orders integration E2E (chunk)', () => {
  beforeEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
    resetOrderSplitterStoresForTests();
  });

  it('POST happy path $100 60/40: full breakdown matches engine math', async () => {
    const res = await postSplit().send(splitBodyUsd100SixtyForty());
    expect(res.status).toBe(201);
    expect(res.body.meta).toEqual({ idempotencyHit: false });
    expect(res.body.totalAmount).toBe(100);
    expect(res.body.orderType).toBe('BUY');
    expect(res.body.breakdown.lines).toHaveLength(2);

    const [a, b] = res.body.breakdown.lines;
    expect(a).toMatchObject({
      symbol: 'AAPL',
      weight: 60,
      allocatedAmount: 60,
      price: 100,
      priceSource: 'DEFAULT',
      quantity: 0.6,
      actualCost: 60,
    });
    expect(b).toMatchObject({
      symbol: 'TSLA',
      weight: 40,
      allocatedAmount: 40,
      price: 100,
      priceSource: 'DEFAULT',
      quantity: 0.4,
      actualCost: 40,
    });
    expect(res.body.breakdown.cashBalance).toBeGreaterThanOrEqual(0);
    expect(res.body.breakdown.cashBalance).toBeLessThan(1e-6);
    expect(res.body.orderId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(res.body.execution?.type).toMatch(/^(IMMEDIATE|SCHEDULED)$/);
    expect(typeof res.body.execution?.timestamp).toBe('string');
  });

  it('idempotency replay: second POST same key → same orderId, 200, idempotencyHit true', async () => {
    const key = randomUUID();
    const body = splitBodyUsd100SixtyForty();
    const first = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(first.body.meta).toEqual({ idempotencyHit: false });

    const second = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(second.status).toBe(200);
    expect(second.body.meta).toEqual({ idempotencyHit: true });
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(stripPostMeta(second.body as Record<string, unknown>)).toEqual(
      stripPostMeta(first.body as Record<string, unknown>),
    );
  });

  it('rapid-fire: after first create, 10 concurrent replays share one orderId', async () => {
    const key = randomUUID();
    const body = splitBodyUsd100SixtyForty();
    const seed = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(seed.status).toBe(201);
    const orderId = seed.body.orderId as string;

    const burst = await Promise.all(
      Array.from({ length: 10 }, () => request(app).post('/orders/split').set('Idempotency-Key', key).send(body)),
    );
    expect(burst.every((r) => r.status === 200)).toBe(true);
    const allReplayHits = burst.every((r) => {
      const meta = (r.body as { meta?: { idempotencyHit?: boolean } }).meta;
      return meta?.idempotencyHit === true;
    });
    expect(allReplayHits).toBe(true);
    expect(new Set(burst.map((r) => (r.body as { orderId: string }).orderId)).size).toBe(1);
    expect(burst[0].body.orderId).toBe(orderId);
  });

  it('33.33% × 3 @ $30: cashBalance is positive rounding dust (~$0.01)', async () => {
    const res = await postSplit().send({
      totalAmount: 100,
      orderType: 'BUY' as const,
      stocks: [
        { weight: 33.33, price: 30 },
        { weight: 33.33, price: 30 },
        { weight: 33.34, price: 30 },
      ],
    });
    expect(res.status).toBe(201);
    const { cashBalance, lines } = res.body.breakdown as { cashBalance: number; lines: { actualCost: number }[] };
    expect(cashBalance).toBeGreaterThan(0);
    expect(cashBalance).toBeCloseTo(0.01, 5);
    const sumCost = lines.reduce((s, l) => s + l.actualCost, 0);
    expect(sumCost + cashBalance).toBeCloseTo(100, 5);
  });

  it('GET /orders after 3 distinct POSTs → count === 3', async () => {
    await Promise.all(
      [0, 1, 2].map(async (i) => {
        const r = await postSplit().send({
          totalAmount: 10 + i,
          orderType: 'BUY' as const,
          stocks: [{ weight: 100, price: 1 }],
        });
        expect(r.status).toBe(201);
      }),
    );
    const list = await request(app).get('/orders');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(3);
    expect(list.body.orders).toHaveLength(3);
  });

  it('GET /orders/:id returns full stored object (matches POST body + createdAt)', async () => {
    const key = randomUUID();
    const body = {
      totalAmount: 42,
      orderType: 'SELL' as const,
      stocks: [
        { symbol: 'ZZ', weight: 70, price: 2 },
        { symbol: 'YY', weight: 30, price: 5 },
      ],
    };
    const postRes = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
    expect(postRes.status).toBe(201);
    const { orderId } = postRes.body;

    const getRes = await request(app).get(`/orders/${orderId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(getRes.body.meta).toEqual({ idempotencyHit: false });

    const { createdAt: _c, ...detail } = getRes.body as Record<string, unknown>;
    expect(detail).toEqual(postRes.body);
  });

  it('PATCH /config precision: subsequent POST uses new maxDecimalPlaces for quantities', async () => {
    const patch = await request(app)
      .patch('/config')
      .send({ maxDecimalPlaces: 1 })
      .set('Content-Type', 'application/json');
    expect(patch.status).toBe(200);
    expect(patch.body.maxDecimalPlaces).toBe(1);

    const res = await postSplit().send({
      totalAmount: 10,
      orderType: 'BUY' as const,
      stocks: [{ symbol: 'P', weight: 100, price: 3 }],
    });
    expect(res.status).toBe(201);
    const qty = res.body.breakdown.lines[0].quantity as number;
    expect(decimalFractionalLength(qty)).toBeLessThanOrEqual(1);
  });

  it('all nine validation error codes return correct machine codes on POST /orders/split', async () => {
    const base = {
      totalAmount: 100,
      orderType: 'BUY' as const,
      stocks: [
        { symbol: 'A', weight: 60, price: 10 },
        { symbol: 'B', weight: 40, price: 10 },
      ],
    };

    const cases: Array<{ code: string; run: () => ReturnType<typeof postSplit> }> = [
      {
        code: ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHTS,
        run: () => postSplit().send({ ...base, stocks: [{ weight: 50, price: 10 }, { weight: 40, price: 10 }] }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.EMPTY_PORTFOLIO,
        run: () => postSplit().send({ ...base, stocks: [] }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.INVALID_AMOUNT,
        run: () => postSplit().send({ ...base, totalAmount: 0 }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHT_VALUE,
        run: () => postSplit().send({ ...base, stocks: [{ weight: 110, price: 10 }, { weight: -10, price: 10 }] }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.INVALID_PRICE,
        run: () => postSplit().send({ ...base, stocks: [{ weight: 50, price: 0 }, { weight: 50, price: 10 }] }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.INVALID_ORDER_TYPE,
        run: () => postSplit().send({ ...base, orderType: 'HOLD' } as unknown as typeof base),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION,
        run: () => postSplit().send({ ...base, totalAmount: 1.2345 }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.PORTFOLIO_TOO_LARGE,
        run: () => postSplit().send({
          totalAmount: 1,
          orderType: 'BUY' as const,
          stocks: [
            ...Array.from({ length: MAX_STOCKS_PER_ORDER }, () => ({ weight: 0 })),
            { weight: 100 },
          ],
        }),
      },
      {
        code: ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
        run: () => postSplit().send({
          ...base,
          stocks: [[1, 2], { weight: 100, price: 1 }] as unknown as typeof base.stocks,
        }),
      },
    ];

    expect(cases).toHaveLength(9);

    await Promise.all(
      cases.map(async ({ code, run }) => {
        const res = await run();
        expect(res.status).toBe(400);
        expect((res.body as { error?: { code?: string } }).error?.code).toBe(code);
      }),
    );
  });
});
