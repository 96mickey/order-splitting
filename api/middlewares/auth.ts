import { Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import APIError from '../utils/APIError';
import type { UserInstance } from '../../types/models';

const normalizeAuthHeader = (req: Request, _res: Response, next: NextFunction) => {
  const raw = req.headers.authorization;
  if (!raw) return next();
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return next();
  const [scheme, ...rest] = parts;
  const token = rest.join(' ');
  if (scheme.toLowerCase() === 'bearer' || scheme.toUpperCase() === 'JWT') {
    req.headers.authorization = `JWT ${token}`;
  }
  return next();
};

const authenticateJwt = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: Error | null, user: false | UserInstance | undefined, info: { message?: string }) => {
    if (err || !user) {
      const message = info?.message || err?.message || 'Unauthorized';
      return next(new APIError({ message, status: 401, errors: [message] }));
    }
    req.user = user;
    return next();
  })(req, res, next);
};

export const authorize = (): RequestHandler[] => [normalizeAuthHeader, authenticateJwt as RequestHandler];
