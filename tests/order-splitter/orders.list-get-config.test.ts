import { randomUUID } from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../config/express';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import { setMaxDecimalPlaces } from '../../order-splitter/runtime-config';
import { orderStore, resetOrderSplitterStoresForTests } from '../../order-splitter/stores';

const DEFAULT_DECIMALS = 3;

function postSplit() {
  return request(app).post('/orders/split').set('Idempotency-Key', randomUUID());
}

function validBody(portfolioId?: string) {
  const base = {
    totalAmount: 100,
    orderType: 'BUY' as const,
    stocks: [{ weight: 100, price: 10 }],
  };
  return portfolioId !== undefined ? { ...base, portfolioId } : base;
}

describe.sequential('GET /orders list, detail shape, PATCH /config propagation', () => {
  beforeEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
    resetOrderSplitterStoresForTests();
  });

  it('GET /orders returns count 0 when no orders exist', async () => {
    const list = await request(app).get('/orders');
    expect(list.status).toBe(200);
    expect(list.body).toEqual({ orders: [], count: 0 });
  });

  it('GET /orders summary uses cashBalance 0 when stored breakdown omits cashBalance', async () => {
    const createdAt = new Date().toISOString();
    const requestBody = {
      totalAmount: 1,
      orderType: 'BUY' as const,
      stocks: [{ weight: 100, price: 1 }],
    };
    orderStore.tryInsert({
      id: 'edge-cb',
      request: requestBody,
      response: {
        status: 'accepted',
        orderId: 'edge-cb',
        totalAmount: 1,
        orderType: 'BUY',
        breakdown: { lines: [] },
      } as Record<string, unknown>,
      createdAt,
    });
    const list = await request(app).get('/orders');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.orders[0].cashBalance).toBe(0);
  });

  it('after 3 POSTs, GET /orders returns count=3 and summary shape', async () => {
    const p1 = await postSplit().send(validBody('pf-1'));
    const p2 = await postSplit().send(validBody());
    const p3 = await postSplit().send(validBody('pf-3'));
    expect([p1.status, p2.status, p3.status]).toEqual([201, 201, 201]);

    const list = await request(app).get('/orders');
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(3);
    expect(list.body.orders).toHaveLength(3);
    list.body.orders.forEach(
      (row: {
        orderId: string;
        createdAt: string;
        portfolioId: string | null;
        orderType: string;
        totalInput: number;
        cashBalance: number;
      }) => {
        expect(row).toMatchObject({
          orderId: expect.stringMatching(/^[0-9a-f-]{36}$/i) as string,
          createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
          orderType: 'BUY',
          totalInput: 100,
          cashBalance: expect.any(Number) as number,
        });
        expect(row.portfolioId === null || typeof row.portfolioId === 'string').toBe(true);
      },
    );

    const withPf = list.body.orders.filter((o: { portfolioId: string | null }) => o.portfolioId !== null);
    expect(withPf.map((o: { portfolioId: string }) => o.portfolioId).sort()).toEqual(['pf-1', 'pf-3']);
  });

  it('GET /orders/unknown-id returns 404 ORDER_NOT_FOUND', async () => {
    const res = await request(app).get(`/orders/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.ORDER_NOT_FOUND);
  });

  it('GET /orders/:orderId returns POST-shaped body plus createdAt and meta.idempotencyHit false', async () => {
    const key = randomUUID();
    const postBody = {
      ...validBody('list-detail-pf'),
      orderType: 'SELL' as const,
    };
    const postRes = await request(app).post('/orders/split').set('Idempotency-Key', key).send(postBody);
    expect(postRes.status).toBe(201);
    const { orderId } = postRes.body;

    const getRes = await request(app).get(`/orders/${orderId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.meta).toEqual({ idempotencyHit: false });
    expect(getRes.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(getRes.body.orderType).toBe('SELL');
    expect(getRes.body.status).toBe('accepted');
    expect(getRes.body.breakdown.lines.length).toBe(1);
    expect(getRes.body.execution).toMatchObject({
      type: expect.stringMatching(/^(IMMEDIATE|SCHEDULED)$/) as string,
      timestamp: expect.any(String) as string,
    });

    const { createdAt: _c, ...detailWithoutCreated } = getRes.body;
    expect(detailWithoutCreated).toEqual(postRes.body);
  });

  it('PATCH /config maxDecimalPlaces propagates to the next POST split', async () => {
    const patch = await request(app).patch('/config').send({ maxDecimalPlaces: 7 }).set('Content-Type', 'application/json');
    expect(patch.status).toBe(200);
    expect(patch.body.maxDecimalPlaces).toBe(7);

    const res = await postSplit().send({
      totalAmount: 1,
      orderType: 'BUY' as const,
      stocks: [{ symbol: 'Q', weight: 100, price: 3 }],
    });
    expect(res.status).toBe(201);
    const qty = res.body.breakdown.lines[0].quantity as number;
    const s = String(qty);
    const dot = s.indexOf('.');
    const frac = dot === -1 ? 0 : s.length - dot - 1;
    expect(frac).toBeLessThanOrEqual(7);
  });
});
