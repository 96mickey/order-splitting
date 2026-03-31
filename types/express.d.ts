import type { Logger } from 'winston';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id from `X-Request-ID` (set by `requestContext` middleware) */
    requestId: string;
    /** Child logger for this request (set by `requestContext` middleware) */
    log: Logger;
  }
}

export {};
