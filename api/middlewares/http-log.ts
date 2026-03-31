import type { Request, Response, NextFunction } from 'express';
import { redactSensitive, sanitizeHeadersForLog } from '../../config/logging-redact';
import { logConfig } from '../../config/vars';
import type { HttpRequestLogFields } from '../../types/logging';

/**
 * Logs one structured line per request when the response finishes (after body parsers).
 * Must be registered after `bodyParser` so `req.body` is available when applicable.
 */
export function httpRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1e6;

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
      userId: req.user?.id,
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

    const logLine = { ...payload, message: 'http_request' };
    if (res.statusCode >= 500) {
      req.log.error(logLine);
    } else if (res.statusCode >= 400) {
      req.log.warn(logLine);
    } else {
      req.log.info(logLine);
    }
  });

  next();
}
