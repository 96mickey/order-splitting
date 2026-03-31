import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICE } from '../../order-splitter/runtime-config';
import type { Stock } from '../../order-splitter/types/order.models';
import { resolveStockPrice } from '../../order-splitter/pricing/resolve-stock-price';

describe('resolveStockPrice', () => {
  it('returns INPUT when price is provided and > 0', () => {
    const stock: Stock = { weight: 50, price: 12.34 };
    expect(resolveStockPrice(stock)).toEqual({
      price: 12.34,
      priceSource: 'INPUT',
    });
  });

  it('returns DEFAULT when price is missing', () => {
    const stock: Stock = { weight: 50 };
    expect(resolveStockPrice(stock)).toEqual({
      price: DEFAULT_PRICE,
      priceSource: 'DEFAULT',
    });
  });

  /**
   * Validated API bodies cannot carry price = 0 (INVALID_PRICE). This branch documents resolver
   * behaviour if called with a non-validated or constructed stock object.
   */
  it('returns DEFAULT when price is 0 (rejected at validation for real requests)', () => {
    const stock: Stock = { weight: 50, price: 0 };
    expect(resolveStockPrice(stock)).toEqual({
      price: DEFAULT_PRICE,
      priceSource: 'DEFAULT',
    });
  });
});
