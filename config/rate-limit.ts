import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { rateLimitConfig } from './vars';

const shouldSkipRateLimit = (req: Request): boolean => (
  req.path === '/healthz' || req.path === '/readyz'
);

const buildRateLimiter = () => {
  const options: Parameters<typeof rateLimit>[0] = {
    windowMs: rateLimitConfig.windowMs,
    max: rateLimitConfig.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: 429,
      message: 'Too many requests. Please try again later.',
    },
    skip: shouldSkipRateLimit,
  };
  return rateLimit(options);
};

export const globalRateLimiter = buildRateLimiter();
export const apiRateLimiter = buildRateLimiter();
