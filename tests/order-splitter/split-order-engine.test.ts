import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../config/express';
import { DEFAULT_PRICE, setMaxDecimalPlaces } from '../../order-splitter/runtime-config';
import { resetOrderSplitterStoresForTests } from '../../order-splitter/stores';
import type { OrderRequest } from '../../order-splitter/types/order.models';
import { splitOrder, flooredQuantity } from '../../order-splitter/split';

const DEFAULT_DECIMALS = 3;

function decimalFractionalLength(n: number): number {
  const s = n.toString();
  if (!s.includes('.')) return 0;
  const [, frac] = s.split('.');
  if (frac.includes('e') || frac.includes('E')) {
    return 0;
  }
  return frac.replace(/0+$/, '').length;
}

describe('flooredQuantity', () => {
  it('uses floor, not round: $100 notional at $150 with 3dp → 0.666 (round would be 0.667)', () => {
    const allocated = 100;
    const price = 150;
    const q = flooredQuantity(allocated, price, 3);
    expect(q).toBe(0.666);
    const naiveRound = Math.round((allocated / price) * 1000) / 1000;
    expect(naiveRound).toBe(0.667);
    expect(q).not.toBe(naiveRound);
  });

  it('matches formula floor((allocated * 10^n) / price) / 10^n', () => {
    expect(flooredQuantity(60, 100, 3)).toBe(0.6);
    expect(flooredQuantity(40, 100, 3)).toBe(0.4);
  });

  describe('destructive / invalid inputs', () => {
    it('throws when price is zero', () => {
      expect(() => flooredQuantity(10, 0, 3)).toThrow(RangeError);
    });

    it('throws when price is negative', () => {
      expect(() => flooredQuantity(10, -5, 3)).toThrow(RangeError);
    });

    it('throws when price is NaN', () => {
      expect(() => flooredQuantity(10, Number.NaN, 3)).toThrow(RangeError);
    });

    it('throws when allocatedAmount is NaN', () => {
      expect(() => flooredQuantity(Number.NaN, 10, 3)).toThrow(RangeError);
    });

    it('throws when decimalPlaces is out of range', () => {
      expect(() => flooredQuantity(1, 1, -1)).toThrow(RangeError);
      expect(() => flooredQuantity(1, 1, 11)).toThrow(RangeError);
    });

    it('throws when decimalPlaces is not an integer', () => {
      expect(() => flooredQuantity(1, 1, 2.5 as unknown as number)).toThrow(RangeError);
    });
  });

  it('supports 0 decimal places (whole units only)', () => {
    expect(flooredQuantity(99, 50, 0)).toBe(1);
  });

  it('supports 10 decimal places (config max)', () => {
    const q = flooredQuantity(1, 3, 10);
    expect(q).toBeCloseTo(0.3333333333, 10);
  });
});

describe('splitOrder', () => {
  it('acceptance: $100 60/40 default prices → AAPL 0.600, TSLA 0.400, cashBalance 0', () => {
    const order: OrderRequest = {
      totalAmount: 100,
      orderType: 'BUY',
      stocks: [
        { symbol: 'AAPL', weight: 60 },
        { symbol: 'TSLA', weight: 40 },
      ],
    };
    const { lines, cashBalance } = splitOrder(order, 3);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      symbol: 'AAPL',
      weight: 60,
      price: DEFAULT_PRICE,
      priceSource: 'DEFAULT',
      quantity: 0.6,
      actualCost: 60,
    });
    expect(lines[1]).toMatchObject({
      symbol: 'TSLA',
      weight: 40,
      price: DEFAULT_PRICE,
      priceSource: 'DEFAULT',
      quantity: 0.4,
      actualCost: 40,
    });
    expect(cashBalance).toBeCloseTo(0, 10);
  });

  it('acceptance: 33.33 / 33.33 / 33.34 at $30 leaves small positive cashBalance (rounding dust)', () => {
    const order: OrderRequest = {
      totalAmount: 100,
      orderType: 'BUY',
      stocks: [
        { symbol: 'X', weight: 33.33, price: 30 },
        { symbol: 'Y', weight: 33.33, price: 30 },
        { symbol: 'Z', weight: 33.34, price: 30 },
      ],
    };
    const { lines, cashBalance } = splitOrder(order, 3);
    expect(lines.every((l) => l.quantity === 1.111)).toBe(true);
    expect(lines.every((l) => l.actualCost === 33.33)).toBe(true);
    expect(cashBalance).toBeCloseTo(0.01, 8);
    expect(cashBalance).toBeGreaterThan(0);
  });

  it('uses INPUT price when provided', () => {
    const order: OrderRequest = {
      totalAmount: 1000,
      orderType: 'SELL',
      stocks: [{ weight: 100, price: 25 }],
    };
    const { lines } = splitOrder(order, 3);
    expect(lines[0].price).toBe(25);
    expect(lines[0].priceSource).toBe('INPUT');
  });

  it('treats a zero-weight line as zero allocation and zero quantity', () => {
    const order: OrderRequest = {
      totalAmount: 100,
      orderType: 'BUY',
      stocks: [
        { symbol: 'A', weight: 100, price: 10 },
        { symbol: 'B', weight: 0, price: 10 },
      ],
    };
    const { lines, cashBalance } = splitOrder(order, 3);
    expect(lines[1].allocatedAmount).toBe(0);
    expect(lines[1].quantity).toBe(0);
    expect(lines[1].actualCost).toBe(0);
    expect(cashBalance).toBeCloseTo(0, 8);
  });

  it('destructive: empty stocks → no spend, full cash balance', () => {
    const order: OrderRequest = {
      totalAmount: 42,
      orderType: 'BUY',
      stocks: [],
    };
    const { lines, cashBalance } = splitOrder(order, 3);
    expect(lines).toHaveLength(0);
    expect(cashBalance).toBe(42);
  });

  it('destructive: rejects non-integer maxDecimalPlaces', () => {
    const order: OrderRequest = {
      totalAmount: 1,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 1 }],
    };
    expect(() => splitOrder(order, 3.1 as unknown as number)).toThrow(RangeError);
  });

  it('destructive: rejects maxDecimalPlaces > 10', () => {
    const order: OrderRequest = {
      totalAmount: 1,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 1 }],
    };
    expect(() => splitOrder(order, 11)).toThrow(RangeError);
  });

  it('destructive: rejects non-finite totalAmount', () => {
    const order: OrderRequest = {
      totalAmount: Number.POSITIVE_INFINITY,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 1 }],
    };
    expect(() => splitOrder(order, 3)).toThrow(RangeError);
  });

  it('edge: tiny notional still floors downward', () => {
    const order: OrderRequest = {
      totalAmount: 0.01,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 100 }],
    };
    const { lines, cashBalance } = splitOrder(order, 3);
    expect(lines[0].quantity).toBe(0);
    expect(lines[0].actualCost).toBe(0);
    expect(cashBalance).toBeCloseTo(0.01, 10);
  });

  it('edge: high price vs allocation yields zero quantity', () => {
    const order: OrderRequest = {
      totalAmount: 10,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 1_000_000 }],
    };
    const { lines, cashBalance } = splitOrder(order, 3);
    expect(lines[0].quantity).toBe(0);
    expect(cashBalance).toBe(10);
  });

  it('mixed INPUT and DEFAULT prices in one order', () => {
    const order: OrderRequest = {
      totalAmount: 200,
      orderType: 'BUY',
      stocks: [
        { symbol: 'P', weight: 50, price: 20 },
        { symbol: 'Q', weight: 50 },
      ],
    };
    const { lines } = splitOrder(order, 3);
    expect(lines[0].priceSource).toBe('INPUT');
    expect(lines[0].price).toBe(20);
    expect(lines[1].priceSource).toBe('DEFAULT');
    expect(lines[1].price).toBe(DEFAULT_PRICE);
  });

  it('invariant: floored spend never exceeds notional (cashBalance ≥ −ε)', () => {
    const order: OrderRequest = {
      totalAmount: 9_999.99,
      orderType: 'SELL',
      stocks: [
        { weight: 12.5, price: 7.25 },
        { weight: 37.5 },
        { weight: 50, price: 11 },
      ],
    };
    const { cashBalance } = splitOrder(order, 4);
    const spent = order.totalAmount - cashBalance;
    expect(spent).toBeLessThanOrEqual(order.totalAmount + 1e-6);
    expect(cashBalance).toBeGreaterThan(-1e-6);
  });

  it('destructive: Infinity price never appears from resolver but flooredQuantity still guarded', () => {
    expect(() => flooredQuantity(1, Number.POSITIVE_INFINITY, 3)).toThrow(RangeError);
  });
});

describe.sequential('split engine HTTP + runtime precision', () => {
  beforeEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
    resetOrderSplitterStoresForTests();
  });

  afterEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
  });

  it('acceptance: PATCH maxDecimalPlaces to 7 then POST split uses 7 fractional digits in quantity', async () => {
    const patch = await request(app)
      .patch('/config')
      .send({ maxDecimalPlaces: 7 })
      .set('Content-Type', 'application/json');
    expect(patch.status).toBe(200);

    const body = {
      totalAmount: 1,
      orderType: 'BUY' as const,
      stocks: [{ symbol: 'Q', weight: 100, price: 3 }],
    };
    const res = await request(app)
      .post('/orders/split')
      .set('Idempotency-Key', randomUUID())
      .send(body);
    expect(res.status).toBe(200);
    const qty = res.body.lines[0].quantity as number;
    expect(decimalFractionalLength(qty)).toBeLessThanOrEqual(7);
    expect(qty).toBeCloseTo(0.3333333, 7);
  });
});
