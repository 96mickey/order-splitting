import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import APIError from '../utils/APIError';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';

/**
 * Stub handler: validation has already run; the split engine will plug in here.
 */
export function postSplitOrder(_req: Request, res: Response): void {
  res.status(httpStatus.OK).json({
    status: 'accepted' as const,
    orderId: null,
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
