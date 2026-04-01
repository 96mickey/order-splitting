import httpStatus from 'http-status';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { requireIdempotencyKey } from '../../api/middlewares/require-idempotency-key';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';
import APIError from '../../api/utils/APIError';

function runMiddleware(rawHeader: string | undefined): {
  nextArg: unknown;
  key: string | undefined;
} {
  const req = {
    get: (name: string) => (name.toLowerCase() === 'idempotency-key' ? rawHeader : undefined),
  } as Request;
  let nextArg: unknown;
  requireIdempotencyKey(req, {} as Response, (err?: unknown) => {
    nextArg = err;
  });
  return { nextArg, key: (req as Request & { idempotencyKey?: string }).idempotencyKey };
}

describe('requireIdempotencyKey', () => {
  it('passes trimmed key to req.idempotencyKey', () => {
    const { nextArg, key } = runMiddleware('  my-key-1  ');
    expect(nextArg).toBeUndefined();
    expect(key).toBe('my-key-1');
  });

  it('accepts X-Idempotency-Key as an alias', () => {
    const req = {
      get: (name: string) => (name.toLowerCase() === 'x-idempotency-key' ? 'alias-key' : undefined),
    } as Request;
    let nextArg: unknown;
    requireIdempotencyKey(req, {} as Response, (err?: unknown) => {
      nextArg = err;
    });
    expect(nextArg).toBeUndefined();
    expect((req as Request & { idempotencyKey?: string }).idempotencyKey).toBe('alias-key');
  });

  it('400 IDEMPOTENCY_KEY_REQUIRED when header is missing', () => {
    const { nextArg, key } = runMiddleware(undefined);
    expect(key).toBeUndefined();
    expect(nextArg).toBeInstanceOf(APIError);
    const err = nextArg as APIError;
    expect(err.status).toBe(httpStatus.BAD_REQUEST);
    expect(err.machineCode).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('400 when header is only whitespace after trim', () => {
    const { nextArg } = runMiddleware(' \t  ');
    expect(nextArg).toBeInstanceOf(APIError);
  });

  it('400 when key length exceeds 256 after trim', () => {
    const { nextArg, key } = runMiddleware(`${'a'.repeat(256)}x`);
    expect(key).toBeUndefined();
    expect(nextArg).toBeInstanceOf(APIError);
    const err = nextArg as APIError;
    expect(err.machineCode).toBe(ORDER_SPLITTER_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('accepts key of exactly 256 characters', () => {
    const { nextArg, key } = runMiddleware('b'.repeat(256));
    expect(nextArg).toBeUndefined();
    expect(key).toHaveLength(256);
  });
});
