import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import APIError from '../utils/APIError';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';

const MAX_KEY_LEN = 256;

/**
 * Requires a non-empty `Idempotency-Key` header (Stripe-style) for split orders.
 */
export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.get('idempotency-key');
  if (raw === undefined) {
    next(
      new APIError({
        message: 'Idempotency-Key header is required',
        status: httpStatus.BAD_REQUEST,
        machineCode: ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      }),
    );
    return;
  }
  const key = raw.trim();
  if (key.length === 0 || key.length > MAX_KEY_LEN) {
    next(
      new APIError({
        message: `Idempotency-Key must be between 1 and ${MAX_KEY_LEN} characters after trimming`,
        status: httpStatus.BAD_REQUEST,
        machineCode: ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      }),
    );
    return;
  }
  req.idempotencyKey = key;
  next();
}
