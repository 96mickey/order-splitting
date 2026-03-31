import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../config/express';
import {
  ALL_ORDER_SPLITTER_ERROR_CODES,
  ORDER_SPLITTER_ERROR_CODES,
} from '../../order-splitter/errors/order-splitter-error-codes';
import { setMaxDecimalPlaces } from '../../order-splitter/runtime-config';
import { validateSplitOrderPayload } from '../../order-splitter/validation';
import { exceedsAllowedDecimalPlaces } from '../../order-splitter/validation/decimal-precision';

const DEFAULT_DECIMALS = 3;

/** Valid baseline body (weights sum to 100). */
function validBody() {
  return {
    totalAmount: 10_000,
    orderType: 'BUY' as const,
    stocks: [
      { symbol: 'AAA', weight: 60, price: 12.34 },
      { symbol: 'BBB', weight: 40 },
    ],
  };
}

describe.sequential('split order validation layer', () => {
  beforeEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
  });

  it('registers exactly nine architecture error codes', () => {
    expect(ALL_ORDER_SPLITTER_ERROR_CODES).toHaveLength(9);
    expect(new Set(ALL_ORDER_SPLITTER_ERROR_CODES).size).toBe(9);
  });

  describe('validateSplitOrderPayload (unit)', () => {
    it('accepts a fully valid payload', () => {
      const result = validateSplitOrderPayload(validBody());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.stocks).toHaveLength(2);
        expect(result.value.orderType).toBe('BUY');
      }
    });

    it('accepts weight sums on the ±0.01 tolerance boundary', () => {
      const upper = validateSplitOrderPayload({
        totalAmount: 1,
        orderType: 'SELL',
        stocks: [{ weight: 60 }, { weight: 40.01 }],
      });
      expect(upper.ok).toBe(true);

      const lower = validateSplitOrderPayload({
        totalAmount: 1,
        orderType: 'SELL',
        stocks: [{ weight: 60 }, { weight: 39.99 }],
      });
      expect(lower.ok).toBe(true);
    });

    it('INVALID_WEIGHTS when weights do not sum to 100 within tolerance', () => {
      const body = { ...validBody(), stocks: [{ weight: 50 }, { weight: 40 }] };
      const result = validateSplitOrderPayload(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHTS);
      }
    });

    it('EMPTY_PORTFOLIO when stocks array is empty', () => {
      const result = validateSplitOrderPayload({ ...validBody(), stocks: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.EMPTY_PORTFOLIO);
      }
    });

    it('INVALID_AMOUNT when totalAmount is zero', () => {
      const result = validateSplitOrderPayload({ ...validBody(), totalAmount: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_AMOUNT);
      }
    });

    it('INVALID_AMOUNT when totalAmount is not finite', () => {
      const result = validateSplitOrderPayload({ ...validBody(), totalAmount: Number.POSITIVE_INFINITY });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_AMOUNT);
      }
    });

    it('INVALID_WEIGHT_VALUE when a weight is negative', () => {
      const body = {
        ...validBody(),
        stocks: [{ weight: 150 }, { weight: -50 }],
      };
      const result = validateSplitOrderPayload(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHT_VALUE);
      }
    });

    it('INVALID_PRICE when price is zero', () => {
      const body = {
        ...validBody(),
        stocks: [
          { weight: 50, price: 0 },
          { weight: 50 },
        ],
      };
      const result = validateSplitOrderPayload(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRICE);
      }
    });

    it('INVALID_ORDER_TYPE when orderType is not BUY or SELL', () => {
      const result = validateSplitOrderPayload({ ...validBody(), orderType: 'HOLD' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_ORDER_TYPE);
      }
    });

    it('INVALID_PRECISION when totalAmount exceeds configured decimal places', () => {
      const result = validateSplitOrderPayload({ ...validBody(), totalAmount: 1.2345 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION);
      }
    });

    it('INVALID_PRECISION when a stock weight exceeds configured decimal places', () => {
      const body = {
        ...validBody(),
        stocks: [
          { weight: 60.0001 },
          { weight: 39.9999 },
        ],
      };
      const result = validateSplitOrderPayload(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION);
      }
    });

    it('MALFORMED_REQUEST when body is not an object', () => {
      expect(validateSplitOrderPayload(null).ok).toBe(false);
      expect(validateSplitOrderPayload([]).ok).toBe(false);
      expect(validateSplitOrderPayload('x').ok).toBe(false);
    });

    it('MALFORMED_REQUEST when stocks is not an array', () => {
      const result = validateSplitOrderPayload({ ...validBody(), stocks: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST);
      }
    });
  });

  describe('decimal precision helper', () => {
    it('flags values that need more fractional digits than allowed', () => {
      expect(exceedsAllowedDecimalPlaces(1.2345, 3)).toBe(true);
      expect(exceedsAllowedDecimalPlaces(1.234, 3)).toBe(false);
    });
  });

  describe('HTTP envelope (integration)', () => {
    it('returns 200 and no error for a valid split payload', async () => {
      const res = await request(app).post('/orders/split').send(validBody());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'accepted', orderId: null });
    });

    it('returns 400 + INVALID_WEIGHTS with code, message, requestId', async () => {
      const res = await request(app)
        .post('/orders/split')
        .send({ ...validBody(), stocks: [{ weight: 50 }, { weight: 40 }] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHTS);
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('returns 400 EMPTY_PORTFOLIO for empty stocks', async () => {
      const res = await request(app).post('/orders/split').send({ ...validBody(), stocks: [] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.EMPTY_PORTFOLIO);
    });

    it('returns 400 INVALID_AMOUNT for non-positive totalAmount', async () => {
      const res = await request(app).post('/orders/split').send({ ...validBody(), totalAmount: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_AMOUNT);
    });

    it('returns 400 INVALID_WEIGHT_VALUE for negative weight', async () => {
      const res = await request(app).post('/orders/split').send({
        ...validBody(),
        stocks: [{ weight: 110 }, { weight: -10 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHT_VALUE);
    });

    it('returns 400 INVALID_PRICE for non-positive price', async () => {
      const res = await request(app).post('/orders/split').send({
        ...validBody(),
        stocks: [{ weight: 50, price: -1 }, { weight: 50 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRICE);
    });

    it('returns 400 INVALID_ORDER_TYPE for unsupported orderType', async () => {
      const res = await request(app).post('/orders/split').send({ ...validBody(), orderType: 'HOLD' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_ORDER_TYPE);
    });

    it('returns 400 INVALID_PRECISION when totalAmount has too many decimals', async () => {
      const res = await request(app).post('/orders/split').send({ ...validBody(), totalAmount: 1.2345 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION);
    });

    it('returns 400 MALFORMED_REQUEST when a stock entry is not an object', async () => {
      const res = await request(app).post('/orders/split').send({
        ...validBody(),
        stocks: [[1, 2], { weight: 100 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST);
    });

    it('returns 400 MALFORMED_REQUEST for invalid JSON (body-parser)', async () => {
      const res = await request(app)
        .post('/orders/split')
        .set('Content-Type', 'application/json')
        .send('{ not-json');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST);
    });

    it('returns 404 ORDER_NOT_FOUND for GET /orders/:id (catalog path)', async () => {
      const res = await request(app).get('/orders/any-id');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.ORDER_NOT_FOUND);
      expect(res.body.error.requestId).toBeDefined();
    });

    it('maps RangeError from PATCH /config to INVALID_PRECISION', async () => {
      const res = await request(app).patch('/config').send({ maxDecimalPlaces: 11 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION);
    });
  });
});
