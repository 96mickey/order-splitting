import type { Request, Response, NextFunction } from 'express';
import { redactSensitive, sanitizeHeadersForLog } from '../../config/logging-redact';
import { logConfig } from '../../config/vars';
import type { HttpRequestLogFields } from '../../types/logging';

/**
 * Canonical single-line access log (chunk format).
 * Example: `[GET /healthz] requestId=550e8400-e29b-41d4-a716-446655440000 latency=1.23ms status=200`
 */
export function buildHttpAccessLogMessage(
  req: Pick<Request, 'method' | 'originalUrl' | 'requestId'>,
  statusCode: number,
  durationMs: number,
): string {
  return `[${req.method} ${req.originalUrl}] requestId=${req.requestId} latency=${durationMs.toFixed(2)}ms status=${statusCode}`;
}

function buildVerboseAccessMeta(
  req: Request,
  res: Response,
  durationMs: number,
): HttpRequestLogFields {
  const payload: HttpRequestLogFields = {
    event: 'http_request',
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    route: req.route?.path ? String(req.route.path) : undefined,
    query: redactSensitive(req.query) as HttpRequestLogFields['query'],
    params: req.params,
    statusCode: res.statusCode,
    durationMs,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    contentLength: res.get('content-length') ?? undefined,
  };

  if (logConfig.httpLogHeaders) {
    payload.headers = sanitizeHeadersForLog(req.headers);
  }
  if (logConfig.httpLogBody && req.body !== undefined) {
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
      if (Object.keys(req.body as object).length > 0) {
        payload.body = redactSensitive(req.body);
      }
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      payload.body = `[text:${req.body.length} chars]`;
    }
  }

  return payload;
}

/**
 * Instruments every request: high-res timing and exactly **one** access log line on `finish`
 * (bracket format). Optional structured fields when `LOG_HTTP_ACCESS_JSON=true`.
 *
 * Must run after `requestContext` and body parsers.
 */
export function httpRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1e6;
    const accessMessage = buildHttpAccessLogMessage(req, res.statusCode, durationMs);
    const verboseMeta = logConfig.httpAccessVerboseJson
      ? buildVerboseAccessMeta(req, res, durationMs)
      : undefined;

    if (res.statusCode >= 500) {
      if (verboseMeta !== undefined) {
        req.log.error(accessMessage, verboseMeta);
      } else {
        req.log.error(accessMessage);
      }
    } else if (res.statusCode >= 400) {
      if (verboseMeta !== undefined) {
        req.log.warn(accessMessage, verboseMeta);
      } else {
        req.log.warn(accessMessage);
      }
    } else if (verboseMeta !== undefined) {
      req.log.info(accessMessage, verboseMeta);
    } else {
      req.log.info(accessMessage);
    }
  });

  next();
}
