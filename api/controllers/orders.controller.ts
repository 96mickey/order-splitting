import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import APIError from '../utils/APIError';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import { getConfigSnapshot } from '../../order-splitter/runtime-config';
import { splitOrder } from '../../order-splitter/split';

/**
 * Runs the split engine after validation; response includes per-line breakdown and cash balance.
 */
export function postSplitOrder(req: Request, res: Response): void {
  const order = req.validatedSplitOrder!;
  const maxDecimalPlaces = getConfigSnapshot().maxDecimalPlaces;
  const { lines, cashBalance } = splitOrder(order, maxDecimalPlaces);
  res.status(httpStatus.OK).json({
    status: 'accepted' as const,
    orderId: null,
    totalAmount: order.totalAmount,
    orderType: order.orderType,
    lines,
    cashBalance,
  });
}

/**
 * Placeholder for future persistence — documents `ORDER_NOT_FOUND` in the error catalog.
 */
export function getOrderById(_req: Request, _res: Response, next: NextFunction): void {
  next(
    new APIError({
      message: 'Order not found',
      status: httpStatus.NOT_FOUND,
      machineCode: ORDER_SPLITTER_ERROR_CODES.ORDER_NOT_FOUND,
    }),
  );
}
