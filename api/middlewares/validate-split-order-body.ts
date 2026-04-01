import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import APIError from '../utils/APIError';
import { validateSplitOrderPayload } from '../../order-splitter/validation';

/**
 * Parses and validates `POST /orders/split` JSON body into `req.validatedSplitOrder`.
 * On failure, forwards an operational `APIError` with the architecture `machineCode`.
 */
export function validateSplitOrderBody(req: Request, _res: Response, next: NextFunction): void {
  const result = validateSplitOrderPayload(req.body);
  if (!result.ok) {
    next(
      new APIError({
        message: result.error.message,
        status: httpStatus.BAD_REQUEST,
        machineCode: result.error.code,
      }),
    );
    return;
  }
  req.validatedSplitOrder = result.value;
  next();
}
