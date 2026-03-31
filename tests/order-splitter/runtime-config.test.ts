import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../config/express';
import * as runtimeConfig from '../../order-splitter/runtime-config';

const {
  DEFAULT_PRICE,
  MARKET_TIMEZONE,
  getConfigSnapshot,
  setMaxDecimalPlaces,
} = runtimeConfig;

const DEFAULT_DECIMALS = 3;

/** Shared module state — run this suite sequentially. */
describe.sequential('order-splitter runtime-config', () => {
  beforeEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
  });

  describe('getConfigSnapshot', () => {
    it('returns architecture defaults', () => {
      const snap = getConfigSnapshot();
      expect(snap).toEqual({
        defaultPrice: DEFAULT_PRICE,
        marketTimezone: MARKET_TIMEZONE,
        maxDecimalPlaces: DEFAULT_DECIMALS,
      });
    });

    it('returns a new object each call (caller cannot mutate internal state)', () => {
      const a = getConfigSnapshot();
      const b = getConfigSnapshot();
      expect(a).not.toBe(b);
      a.maxDecimalPlaces = 99;
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(DEFAULT_DECIMALS);
    });

    it('reflects last successful setMaxDecimalPlaces', () => {
      setMaxDecimalPlaces(0);
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(0);
      setMaxDecimalPlaces(10);
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(10);
    });
  });

  describe('setMaxDecimalPlaces', () => {
    it('accepts boundary integers 0 and 10', () => {
      setMaxDecimalPlaces(0);
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(0);
      setMaxDecimalPlaces(10);
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(10);
    });

    it('accepts integer-like float 7.0', () => {
      setMaxDecimalPlaces(7.0);
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(7);
    });

    it('rejects non-integers', () => {
      expect(() => setMaxDecimalPlaces(3.1)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(3.0000001)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(Number.EPSILON)).toThrow(RangeError);
    });

    it('rejects out-of-range integers', () => {
      expect(() => setMaxDecimalPlaces(-1)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(11)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(100)).toThrow(RangeError);
    });

    it('rejects NaN and non-finite numbers', () => {
      expect(() => setMaxDecimalPlaces(Number.NaN)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(Number.POSITIVE_INFINITY)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    });

    it('rejects null and undefined at runtime', () => {
      expect(() => setMaxDecimalPlaces(null as unknown as number)).toThrow(RangeError);
      expect(() => setMaxDecimalPlaces(undefined as unknown as number)).toThrow(RangeError);
    });

    it('does not change state when validation throws', () => {
      setMaxDecimalPlaces(5);
      expect(() => setMaxDecimalPlaces(50)).toThrow(RangeError);
      expect(getConfigSnapshot().maxDecimalPlaces).toBe(5);
    });

    it('rejects boxed Number objects', () => {
      expect(() => setMaxDecimalPlaces(Object(5) as unknown as number)).toThrow(RangeError);
    });

    it('rejects string numbers (defense in depth vs HTTP layer)', () => {
      expect(() => setMaxDecimalPlaces('8' as unknown as number)).toThrow(RangeError);
    });
  });

  describe('HTTP GET /config', () => {
    it('returns 200 and full snapshot', async () => {
      setMaxDecimalPlaces(4);
      const res = await request(app).get('/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        defaultPrice: DEFAULT_PRICE,
        marketTimezone: MARKET_TIMEZONE,
        maxDecimalPlaces: 4,
      });
    });
  });

  describe('HTTP PATCH /config', () => {
    it('updates maxDecimalPlaces and returns new snapshot', async () => {
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: 7 })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(200);
      expect(res.body.maxDecimalPlaces).toBe(7);
      const getRes = await request(app).get('/config');
      expect(getRes.body.maxDecimalPlaces).toBe(7);
    });

    it('rejects missing maxDecimalPlaces', async () => {
      const res = await request(app).patch('/config').send({}).set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects null maxDecimalPlaces', async () => {
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: null })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects string maxDecimalPlaces (strict JSON number)', async () => {
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: '5' })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects boolean maxDecimalPlaces', async () => {
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: true })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects fractional maxDecimalPlaces', async () => {
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: 2.5 })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects below range and above range', async () => {
      const low = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: -1 })
        .set('Content-Type', 'application/json');
      expect(low.status).toBe(400);

      const high = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: 11 })
        .set('Content-Type', 'application/json');
      expect(high.status).toBe(400);
    });

    it('rejects unknown body keys', async () => {
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: 3, injected: true })
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects non-object JSON body', async () => {
      const res = await request(app)
        .patch('/config')
        .send([1, 2, 3])
        .set('Content-Type', 'application/json');
      expect(res.status).toBe(400);
    });

    it('rejects wrong Content-Type with JSON-looking body', async () => {
      const res = await request(app)
        .patch('/config')
        .send('{"maxDecimalPlaces":5}')
        .set('Content-Type', 'text/plain');
      expect(res.status).toBe(400);
    });

    it('returns 404 for unsupported methods on /config', async () => {
      const put = await request(app).put('/config').send({ maxDecimalPlaces: 1 });
      expect(put.status).toBe(404);
      const del = await request(app).delete('/config');
      expect(del.status).toBe(404);
    });
  });

  describe('HTTP error envelope for INVALID_PRECISION', () => {
    it('returns architecture error shape when RangeError propagates (defense in depth)', async () => {
      const spy = vi.spyOn(runtimeConfig, 'setMaxDecimalPlaces').mockImplementationOnce(() => {
        throw new RangeError('maxDecimalPlaces must be an integer from 0 to 10');
      });
      const res = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: 5 })
        .set('Content-Type', 'application/json');
      spy.mockRestore();
      setMaxDecimalPlaces(DEFAULT_DECIMALS);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: {
          code: 'INVALID_PRECISION',
          message: expect.stringContaining('maxDecimalPlaces') as string,
          requestId: expect.any(String) as string,
        },
      });
    });
  });
});
