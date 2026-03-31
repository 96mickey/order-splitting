import express from 'express';
import { validateSplitOrderBody } from '../middlewares/validate-split-order-body';
import { getOrderById, postSplitOrder } from '../controllers/orders.controller';

const router = express.Router();

router.post('/orders/split', validateSplitOrderBody, postSplitOrder);
router.get('/orders/:orderId', getOrderById);

export default router;
