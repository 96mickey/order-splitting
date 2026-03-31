import express from 'express';
import { protectedPing } from '../../controllers/example.controller';
import { authorize } from '../../middlewares/auth';

const router = express.Router();

router.get('/protected/ping', ...authorize(), protectedPing);

export default router;
