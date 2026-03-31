import type { IncomingHttpHeaders } from 'http';

const SENSITIVE_KEY = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'token',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'credit_card',
  'cvv',
]);

function normalizeKey(key: string): string {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

/**
 * Recursively redact known sensitive keys from objects/arrays (for request bodies, query).
 */
export function redactSensitive(input: unknown, depth = 0): unknown {
  if (depth > 12) return '[MaxDepth]';
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(input as Record<string, unknown>).forEach(([k, v]) => {
      if (SENSITIVE_KEY.has(normalizeKey(k))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitive(v, depth + 1);
      }
    });
    return out;
  }
  return input;
}

const HEADER_ALLOW = new Set([
  'host',
  'user-agent',
  'accept',
  'content-type',
  'content-length',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-request-id',
  'accept-encoding',
  'accept-language',
  'referer',
  'origin',
]);

/**
 * Subset of headers useful for debugging without logging secrets.
 */
export function sanitizeHeadersForLog(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(headers).forEach(([rawKey, rawVal]) => {
    const key = rawKey.toLowerCase();
    if (!HEADER_ALLOW.has(key) || rawVal === undefined) {
      return;
    }
    out[key] = Array.isArray(rawVal) ? rawVal.join(', ') : rawVal;
  });
  if (headers.authorization) out.authorization = '[REDACTED]';
  if (headers.cookie) out.cookie = '[REDACTED]';
  return out;
}
