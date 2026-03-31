import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { createRequestLogger } from '../../config/logger';

/**
 * Assigns correlation id (`X-Request-ID`) and a child logger on `req.log` for the request lifetime.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.get('x-request-id');
  const requestId = headerId && headerId.trim().length > 0 ? headerId.trim() : randomUUID();
  res.setHeader('x-request-id', requestId);
  req.requestId = requestId;
  req.log = createRequestLogger(requestId);
  next();
}
