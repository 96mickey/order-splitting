import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { isCelebrateError } from 'celebrate';
import APIError from '../utils/APIError';
import type { ArchitectureErrorEnvelope } from '../../types/errors';
import { getRequestLogger } from '../../config/logger';
import { env } from '../../config/vars';
import { extractCelebrateValidationItems, type JsonErrorBody, type ErrorWithStatus } from '../../types/errors';
import { ORDER_SPLITTER_ERROR_CODES } from '../../order-splitter/errors/order-splitter-error-codes';

const DEFAULT_ERROR_STATUS = httpStatus.INTERNAL_SERVER_ERROR;
const DEFAULT_ERROR_MESSAGE = 'Internal Server Error';
const IS_DEVELOPMENT = env === 'development';

function httpStatusLabel(status: number): string {
  const key = status as keyof typeof httpStatus;
  const value = httpStatus[key];
  return typeof value === 'string' ? value : DEFAULT_ERROR_MESSAGE;
}

const logError = (err: ErrorWithStatus, req: Request): void => {
  const log = getRequestLogger(req);
  const payload = {
    message: 'request_error' as const,
    errMessage: err.message,
    status: err.status,
    url: req.originalUrl,
    method: req.method,
    ...(IS_DEVELOPMENT || !err.status || err.status >= 500 ? { stack: err.stack } : {}),
  };
  if (!err.status || err.status >= 500) {
    log.error(payload);
    return;
  }
  log.warn(payload);
};

export const handler = (err: ErrorWithStatus, req: Request, res: Response, _next: NextFunction): void => {
  const status = Number.parseInt(String(err.status || DEFAULT_ERROR_STATUS), 10) || DEFAULT_ERROR_STATUS;
  logError(err, req);

  if (err instanceof APIError && err.machineCode) {
    const body: ArchitectureErrorEnvelope = {
      error: {
        code: err.machineCode,
        message: err.message || httpStatusLabel(status) || DEFAULT_ERROR_MESSAGE,
        requestId: req.requestId,
      },
    };
    res.status(status).json(body);
    return;
  }

  const response: JsonErrorBody = {
    code: status,
    message: err.message || httpStatusLabel(status) || DEFAULT_ERROR_MESSAGE,
  };
  if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    response.errors = err.errors;
  }
  if (IS_DEVELOPMENT && err.stack) response.stack = err.stack;
  res.status(status).json(response);
};

export const validationError = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  if (!isCelebrateError(err)) {
    next(err);
    return;
  }
  const validationErrors = extractCelebrateValidationItems(err);
  const firstError = validationErrors[0];
  const errorMessage = firstError?.message || 'Validation Error';
  const apiError = new APIError({
    message: errorMessage,
    status: httpStatus.BAD_REQUEST,
    errors: validationErrors.map((e) => e.message).filter(Boolean),
  });
  next(apiError);
};

function isJsonBodyParseFailure(err: unknown): err is ErrorWithStatus & { type: string } {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as ErrorWithStatus & { type?: string };
  return e.status === httpStatus.BAD_REQUEST && e.type === 'entity.parse.failed';
}

export const converter = (err: unknown, _req: Request, _res: Response, next: NextFunction): void => {
  if (err instanceof APIError) {
    next(err);
    return;
  }
  if (isJsonBodyParseFailure(err)) {
    next(
      new APIError({
        message: err.message || 'Malformed JSON body',
        status: httpStatus.BAD_REQUEST,
        machineCode: ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      }),
    );
    return;
  }
  if (err instanceof RangeError) {
    next(new APIError({
      message: err.message,
      status: httpStatus.BAD_REQUEST,
      machineCode: ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION,
    }));
    return;
  }
  const e = err as ErrorWithStatus;
  const status = e.status
    || (e.statusCode && e.statusCode < 600 ? e.statusCode : undefined)
    || DEFAULT_ERROR_STATUS;
  const convertedError = new APIError({
    message: e.message || httpStatusLabel(status) || DEFAULT_ERROR_MESSAGE,
    status,
    stack: e.stack,
    errors: e.errors,
  });
  next(convertedError);
};

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new APIError({ message: `Route ${req.method} ${req.originalUrl} not found`, status: httpStatus.NOT_FOUND }));
};
