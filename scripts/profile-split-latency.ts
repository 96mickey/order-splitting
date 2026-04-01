/* eslint-disable import/no-extraneous-dependencies, no-await-in-loop -- script uses supertest; sequential timing */
/**
 * Compare POST /orders/split latency with LOG_ROTATING_FILES on vs off (Winston file transports).
 *
 * Usage (from repo root):
 *   LOG_ROTATING_FILES=false npx tsx scripts/profile-split-latency.ts
 *   LOG_ROTATING_FILES=true  npx tsx scripts/profile-split-latency.ts
 *
 * Requires .env keys satisfied by dotenv-safe (or set NODE_ENV=test to match test harness).
 */
import { randomUUID } from 'crypto';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RATE_LIMIT_ENABLED = 'false';

async function main(): Promise<void> {
  const [{ default: request }, { default: app }] = await Promise.all([import('supertest'), import('../config/express')]);

  const iterations = Number.parseInt(process.env.PROFILE_ITERATIONS || '300', 10);
  const body = {
    totalAmount: 1,
    orderType: 'BUY' as const,
    stocks: [{ weight: 100, price: 10 }],
  };

  const agent = request.agent(app);
  const samples: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    const res = await agent.post('/orders/split').set('Idempotency-Key', randomUUID()).send(body);
    samples.push(performance.now() - t0);
    if (res.status !== 201) {
      console.error('Unexpected status', res.status, res.body);
      process.exit(1);
    }
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)];

  console.info('[profile-split-latency]', {
    iterations,
    LOG_ROTATING_FILES: process.env.LOG_ROTATING_FILES ?? '(default from NODE_ENV)',
    minMs: sorted[0].toFixed(3),
    maxMs: sorted[sorted.length - 1].toFixed(3),
    avgMs: (sum / sorted.length).toFixed(3),
    p95Ms: p95.toFixed(3),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
