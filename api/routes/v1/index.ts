import express from 'express';
import authRoutes from './auth.route';
import exampleRoutes from './example.route';

const router = express.Router();

router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/example', exampleRoutes);

export default router;
