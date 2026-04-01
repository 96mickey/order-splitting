import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import APIError from '../utils/APIError';
import { executeSplitOrder } from '../services/split-order.service';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import { getConfigSnapshot } from '../../order-splitter/runtime-config';
import { orderStore } from '../../order-splitter/stores';
import type { SplitOrderPostResponse } from '../../order-splitter/types/split-order-response';

/** Exhaustive-switch guard; should never run at runtime. */
function assertNever(value: never): never {
  throw new Error(`Unreachable split-order outcome: ${String(value)}`);
}

/** Parses optional non-production stall header for idempotency overlap experiments. */
function readTestStallMs(req: Request): number | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  const raw = req.get('x-test-stall-ms');
  const ms = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(ms) || ms <= 0 || ms > 5000) {
    return undefined;
  }
  return ms;
}

/**
 * HTTP adapter: validates inputs are present, delegates to {@link executeSplitOrder}, maps outcomes.
 */
export async function postSplitOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await executeSplitOrder({
      idempotencyKey: req.idempotencyKey!,
      order: req.validatedSplitOrder!,
      maxDecimalPlaces: getConfigSnapshot().maxDecimalPlaces,
      testStallMs: readTestStallMs(req),
    });

    switch (result.type) {
      case 'success': {
        const body: SplitOrderPostResponse = {
          ...result.payload,
          meta: { idempotencyHit: false },
        };
        res.status(httpStatus.CREATED).json(body);
        return;
      }
      case 'replay': {
        const body: SplitOrderPostResponse = {
          ...result.payload,
          meta: { idempotencyHit: true },
        };
        res.status(httpStatus.OK).json(body);
        return;
      }
      case 'in_progress':
        next(
          new APIError({
            message: 'A request with this Idempotency-Key is already being processed',
            status: httpStatus.CONFLICT,
            machineCode: ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
          }),
        );
        return;
      case 'conflict':
        next(
          new APIError({
            message: 'Idempotency-Key was already used with a different request body',
            status: httpStatus.CONFLICT,
            machineCode: ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          }),
        );
        return;
      case 'insert_failed':
        next(
          new APIError({
            message: 'Failed to allocate unique order id',
            status: httpStatus.INTERNAL_SERVER_ERROR,
          }),
        );
        return;
      default:
        return assertNever(result);
    }
  } catch (err) {
    next(err);
  }
}

export function getOrderById(req: Request, res: Response, next: NextFunction): void {
  const row = orderStore.getById(req.params.orderId);
  if (!row) {
    next(
      new APIError({
        message: 'Order not found',
        status: httpStatus.NOT_FOUND,
        machineCode: ORDER_SPLITTER_ERROR_CODES.ORDER_NOT_FOUND,
      }),
    );
    return;
  }
  res.status(httpStatus.OK).json(row.response);
}
