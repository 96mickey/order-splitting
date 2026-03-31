import express from 'express';
import exampleRoutes from './example.route';

const router = express.Router();

router.use('/api/v1/example', exampleRoutes);

export default router;
