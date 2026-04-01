import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { validateSplitOrderBody } from '../../api/middlewares/validate-split-order-body';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import APIError from '../../api/utils/APIError';

describe('validateSplitOrderBody', () => {
  it('sets req.validatedSplitOrder when body is valid', () => {
    const body = {
      totalAmount: 100,
      orderType: 'BUY' as const,
      stocks: [{ weight: 100, price: 10 }],
    };
    const req = { body } as Request;
    let nextArg: unknown;
    validateSplitOrderBody(req, {} as Response, (err?: unknown) => {
      nextArg = err;
    });
    expect(nextArg).toBeUndefined();
    expect(req.validatedSplitOrder).toEqual(body);
  });

  it('forwards APIError with validation machineCode on invalid body', () => {
    const req = {
      body: {
        totalAmount: 100,
        orderType: 'BUY',
        stocks: [{ weight: 50 }, { weight: 40 }],
      },
    } as Request;
    let nextArg: unknown;
    validateSplitOrderBody(req, {} as Response, (err?: unknown) => {
      nextArg = err;
    });
    expect(nextArg).toBeInstanceOf(APIError);
    const err = nextArg as APIError;
    expect(err.status).toBe(httpStatus.BAD_REQUEST);
    expect(err.machineCode).toBe(ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHTS);
  });
});
