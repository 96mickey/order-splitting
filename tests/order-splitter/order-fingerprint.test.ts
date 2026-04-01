import { describe, expect, it } from 'vitest';
import type { OrderRequest } from '../../order-splitter/types/order.models';
import { fingerprintOrderRequest } from '../../order-splitter/idempotency';

describe('fingerprintOrderRequest', () => {
  it('is stable for the same logical order', () => {
    const order: OrderRequest = {
      totalAmount: 10_000,
      orderType: 'BUY',
      stocks: [
        { symbol: 'AAA', weight: 60, price: 12.34 },
        { symbol: 'BBB', weight: 40 },
      ],
    };
    expect(fingerprintOrderRequest(order)).toBe(fingerprintOrderRequest(order));
  });

  it('ignores array order of stocks (canonical sort)', () => {
    const a: OrderRequest = {
      totalAmount: 100,
      orderType: 'SELL',
      stocks: [
        { weight: 30, price: 1, symbol: 'X' },
        { weight: 70, price: 2, symbol: 'Y' },
      ],
    };
    const b: OrderRequest = {
      ...a,
      stocks: [a.stocks[1], a.stocks[0]],
    };
    expect(fingerprintOrderRequest(a)).toBe(fingerprintOrderRequest(b));
  });

  it('differs when totalAmount changes', () => {
    const base: OrderRequest = {
      totalAmount: 100,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 10 }],
    };
    expect(fingerprintOrderRequest(base)).not.toBe(
      fingerprintOrderRequest({ ...base, totalAmount: 101 }),
    );
  });

  it('differs when orderType changes', () => {
    const stocks = [{ weight: 100, price: 10 }];
    expect(
      fingerprintOrderRequest({ totalAmount: 1, orderType: 'BUY', stocks }),
    ).not.toBe(fingerprintOrderRequest({ totalAmount: 1, orderType: 'SELL', stocks }));
  });

  it('differs when a stock leg changes', () => {
    const base: OrderRequest = {
      totalAmount: 50,
      orderType: 'BUY',
      stocks: [
        { weight: 50, price: 1 },
        { weight: 50, price: 2 },
      ],
    };
    const changed: OrderRequest = {
      ...base,
      stocks: [
        { weight: 50, price: 1 },
        { weight: 50, price: 2.01 },
      ],
    };
    expect(fingerprintOrderRequest(base)).not.toBe(fingerprintOrderRequest(changed));
  });

  it('treats optional symbol consistently (omitted vs present)', () => {
    const withoutSymbol: OrderRequest = {
      totalAmount: 1,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 5 }],
    };
    const withSymbol: OrderRequest = {
      ...withoutSymbol,
      stocks: [{ symbol: 'ZZZ', weight: 100, price: 5 }],
    };
    expect(fingerprintOrderRequest(withoutSymbol)).not.toBe(fingerprintOrderRequest(withSymbol));
  });

  it('includes portfolioId in fingerprint when present', () => {
    const base: OrderRequest = {
      totalAmount: 1,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 1 }],
    };
    const withId = { ...base, portfolioId: 'A' };
    expect(fingerprintOrderRequest(base)).not.toBe(fingerprintOrderRequest(withId));
    expect(fingerprintOrderRequest(withId)).toBe(fingerprintOrderRequest({ ...base, portfolioId: 'A' }));
  });

  it('produces a 64-char hex sha256 digest', () => {
    const fp = fingerprintOrderRequest({
      totalAmount: 1,
      orderType: 'BUY',
      stocks: [{ weight: 100, price: 1 }],
    });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
