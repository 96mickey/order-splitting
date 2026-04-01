import express from 'express';
import { requireIdempotencyKey } from '../middlewares/require-idempotency-key';
import { validateSplitOrderBody } from '../middlewares/validate-split-order-body';
import { getOrderById, listOrders, postSplitOrder } from '../controllers/orders.controller';

const router = express.Router();

router.get('/orders', listOrders);
router.post('/orders/split', requireIdempotencyKey, validateSplitOrderBody, postSplitOrder);
router.get('/orders/:orderId', getOrderById);

export default router;
