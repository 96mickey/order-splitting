import express from 'express';
import configRoutes from './config.route';
import ordersRoutes from './orders.route';
import routesV1 from './v1';
import { isRedisReady } from '../../config/redis';
import { redisConfig } from '../../config/vars';

const router = express.Router();

router.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/readyz', (_req, res) => {
  const redisReady = isRedisReady();
  const redisOk = !redisConfig.enabled || redisReady;
  let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';
  if (redisConfig.enabled) {
    redisStatus = redisReady ? 'up' : 'down';
  }

  res.status(redisOk ? 200 : 503).json({
    status: redisOk ? 'ready' : 'not_ready',
    checks: {
      redis: redisStatus,
    },
  });
});

router.use(configRoutes);
router.use(ordersRoutes);
router.use(routesV1);

export default router;
