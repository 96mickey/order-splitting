import type { Logger as WinstonLogger } from 'winston';

/**
 * Arbitrary structured metadata attached to log lines (JSON-serializable values preferred).
 */
export type LogMeta = Record<string, unknown>;

/**
 * Fields commonly present on HTTP access / audit logs (built by `http-log` middleware).
 */
export interface HttpRequestLogFields {
  event: 'http_request';
  requestId: string;
  method: string;
  path: string;
  originalUrl: string;
  route?: string;
  query: Record<string, unknown>;
  params: Record<string, string>;
  statusCode: number;
  durationMs: number;
  ip: string | undefined;
  userAgent: string | undefined;
  userId?: number;
  contentLength?: string;
  /** Present when `LOG_HTTP_BODY=true` and body is JSON-like */
  body?: unknown;
  /** Present when `LOG_HTTP_HEADERS=true` */
  headers?: Record<string, string>;
}

/**
 * Application-level logger for use outside Express handlers (startup, jobs, scripts).
 * Prefer `req.log` inside HTTP handlers when available.
 */
export interface AppLog {
  error(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
}

/**
 * Request-scoped logger (Winston child) attached after `requestContext` middleware.
 */
export type RequestLogger = WinstonLogger;
