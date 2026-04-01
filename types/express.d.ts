import type { Logger } from 'winston';
import type { OrderRequest } from '../order-splitter/types/order.models';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id from `X-Request-ID` (set by `requestContext` middleware) */
    requestId: string;
    /** Child logger for this request (set by `requestContext` middleware) */
    log: Logger;
    /** Set by `validateSplitOrderBody` after successful validation */
    validatedSplitOrder?: OrderRequest;
    /** Set by `requireIdempotencyKey` on `POST /orders/split` */
    idempotencyKey?: string;
  }
}

export {};
