/**
 * Maps to `execution_plan.pdf` SECTION 3 (Test Plan) — validation gaps, performance with latency stats,
 * and 1000 sequential unique POSTs per PDF.
 *
 * Overlapping scenarios (60/40 happy path, idempotency, timing unit rows, etc.) live in sibling suites;
 * this file fills PDF-only conditions and load tests.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../config/express';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import { setMaxDecimalPlaces } from '../../order-splitter/runtime-config';
import { resetOrderSplitterStoresForTests } from '../../order-splitter/stores';

const DEFAULT_DECIMALS = 3;

function postSplit() {
  return request(app).post('/orders/split').set('Idempotency-Key', randomUUID());
}

function postSplitStalled(idempotencyKey: string, stallMs: string, body: object) {
  return request(app)
    .post('/orders/split')
    .set('Idempotency-Key', idempotencyKey)
    .set('x-test-stall-ms', stallMs)
    .send(body);
}

function decimalFractionalLength(n: number): number {
  const s = n.toString();
  if (!s.includes('.')) return 0;
  const [, frac] = s.split('.');
  if (frac.includes('e') || frac.includes('E')) return 0;
  return frac.replace(/0+$/, '').length;
}

/** Sorted ascending; nearest-rank p-percentile (e.g. p=95). */
function latencyPercentileMs(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.max(0, Math.min(sortedMs.length - 1, rank))];
}

function logLatencyStats(label: string, samplesMs: number[]): void {
  if (samplesMs.length === 0) return;
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const p95 = latencyPercentileMs(sorted, 95);
  // PDF §3: "Log min / max / avg / p95 latency to console."
  console.info(
    `[perf] ${label} n=${sorted.length} minMs=${min.toFixed(3)} maxMs=${max.toFixed(3)} avgMs=${avg.toFixed(3)} p95Ms=${p95.toFixed(3)}`,
  );
}

describe.sequential('execution_plan.pdf §3 — gaps + performance', () => {
  beforeEach(() => {
    setMaxDecimalPlaces(DEFAULT_DECIMALS);
    resetOrderSplitterStoresForTests();
  });

  describe('Validation (PDF table — HTTP)', () => {
    it('weights sum to 99.5 → 400 INVALID_WEIGHTS', async () => {
      const res = await postSplit().send({
        totalAmount: 100,
        orderType: 'BUY' as const,
        stocks: [
          { weight: 49.5, price: 10 },
          { weight: 50, price: 10 },
        ],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHTS);
    });

    it('totalAmount = -10 → 400 INVALID_AMOUNT', async () => {
      const res = await postSplit().send({
        totalAmount: -10,
        orderType: 'BUY' as const,
        stocks: [{ weight: 100, price: 1 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_AMOUNT);
    });

    it('PATCH /config maxDecimalPlaces = 11 → 400 INVALID_PRECISION', async () => {
      const res = await request(app)
        .patch('/config')
        .set('Content-Type', 'application/json')
        .send({ maxDecimalPlaces: 11 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION);
    });
  });

  describe('Concurrent idempotency (PDF vs in-flight semantics)', () => {
    it('10 simultaneous first POSTs same key: one 201, others 409 IDEMPOTENCY_IN_PROGRESS (then replay works)', async () => {
      const key = randomUUID();
      const body = {
        totalAmount: 5,
        orderType: 'BUY' as const,
        stocks: [{ weight: 100, price: 2 }],
      };
      const burst = await Promise.all(
        Array.from({ length: 10 }, () => postSplitStalled(key, '150', body)),
      );
      const statuses = burst.map((r) => r.status).sort((a, b) => a - b);
      expect(statuses.filter((s) => s === 201).length).toBe(1);
      expect(statuses.filter((s) => s === 409).length).toBe(9);
      burst.forEach((r) => {
        if (r.status === 409) {
          expect(r.body.error.code).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS);
        }
      });
      await new Promise<void>((r) => {
        setTimeout(r, 200);
      });
      const replay = await request(app).post('/orders/split').set('Idempotency-Key', key).send(body);
      expect(replay.status).toBe(200);
      expect(replay.body.meta?.idempotencyHit).toBe(true);
    });
  });

  describe('Integration — PATCH precision = 7 then POST (PDF)', () => {
    it('quantities carry up to 7 decimal places', async () => {
      const patch = await request(app)
        .patch('/config')
        .send({ maxDecimalPlaces: 7 })
        .set('Content-Type', 'application/json');
      expect(patch.status).toBe(200);
      expect(patch.body.maxDecimalPlaces).toBe(7);

      const res = await postSplit().send({
        totalAmount: 1,
        orderType: 'BUY' as const,
        stocks: [{ symbol: 'Q', weight: 100, price: 3 }],
      });
      expect(res.status).toBe(201);
      const qty = res.body.breakdown.lines[0].quantity as number;
      expect(decimalFractionalLength(qty)).toBeLessThanOrEqual(7);
      expect(qty).toBeCloseTo(0.3333333, 7);
    });
  });

  describe('Performance (PDF §3)', () => {
    it(
      '1000 sequential idempotent replays: min/max/avg/p95, avg < 50ms, heap bounded',
      { timeout: 120_000 },
      async () => {
        const key = randomUUID();
        const body = {
          totalAmount: 1,
          orderType: 'BUY' as const,
          stocks: [{ weight: 100, price: 10 }],
        };
        const agent = request.agent(app);
        const seed = await agent.post('/orders/split').set('Idempotency-Key', key).send(body);
        expect(seed.status).toBe(201);

        if (typeof global.gc === 'function') global.gc();
        const heapBefore = process.memoryUsage().heapUsed;

        const iterations = 1000;
        const samples: number[] = [];
        /* eslint-disable no-await-in-loop -- sequential latency samples */
        for (let i = 0; i < iterations; i += 1) {
          const t0 = performance.now();
          const r = await agent.post('/orders/split').set('Idempotency-Key', key).send(body);
          samples.push(performance.now() - t0);
          expect(r.status).toBe(200);
          expect(r.body.meta?.idempotencyHit).toBe(true);
        }
        /* eslint-enable no-await-in-loop */

        if (typeof global.gc === 'function') global.gc();
        const heapAfter = process.memoryUsage().heapUsed;
        const heapGrowth = heapAfter - heapBefore;

        const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
        logLatencyStats('POST /orders/split (idempotent replay)', samples);

        expect(avgMs).toBeLessThan(50);
        expect(heapGrowth).toBeLessThan(40 * 1024 * 1024);
      },
    );

    it(
      '1000 sequential unique POST /orders/split: correct 201s, latency stats, bounded heap',
      { timeout: 180_000 },
      async () => {
        const agent = request.agent(app);
        const body = {
          totalAmount: 1,
          orderType: 'BUY' as const,
          stocks: [{ weight: 100, price: 10 }],
        };

        if (typeof global.gc === 'function') global.gc();
        const heapBefore = process.memoryUsage().heapUsed;

        const iterations = 1000;
        const samples: number[] = [];
        /* eslint-disable no-await-in-loop -- sequential load + correctness */
        for (let i = 0; i < iterations; i += 1) {
          const t0 = performance.now();
          const r = await agent
            .post('/orders/split')
            .set('Idempotency-Key', randomUUID())
            .send(body);
          samples.push(performance.now() - t0);
          expect(r.status).toBe(201);
          expect(r.body.meta?.idempotencyHit).toBe(false);
          expect(r.body.orderId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          expect(r.body.breakdown?.lines?.length).toBe(1);
          expect(r.body.execution?.type).toMatch(/^(IMMEDIATE|SCHEDULED)$/);
        }
        /* eslint-enable no-await-in-loop */

        if (typeof global.gc === 'function') global.gc();
        const heapAfter = process.memoryUsage().heapUsed;
        const heapGrowth = heapAfter - heapBefore;

        const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
        logLatencyStats('POST /orders/split (unique Idempotency-Key)', samples);

        // Heavier than replay (1000 new orders); allow more time and heap for stored rows.
        expect(avgMs).toBeLessThan(150);
        expect(heapGrowth).toBeLessThan(200 * 1024 * 1024);
      },
    );
  });
});
