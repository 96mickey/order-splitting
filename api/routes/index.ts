import express from 'express';
import routesV1 from './v1';
import { isDatabaseReady } from '../../db/models';
import { isRedisReady } from '../../config/redis';
import { redisConfig } from '../../config/vars';

const router = express.Router();

router.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/readyz', async (_req, res) => {
  const dbReady = await isDatabaseReady();
  const redisReady = isRedisReady();
  const ready = dbReady && redisReady;
  let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';
  if (redisConfig.enabled) {
    redisStatus = redisReady ? 'up' : 'down';
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      database: dbReady ? 'up' : 'down',
      redis: redisStatus,
    },
  });
});

router.use(routesV1);

export default router;
