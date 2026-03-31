import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import APIError from '../utils/APIError';

export const protectedPing = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    next(new APIError({ message: 'Unauthorized', status: httpStatus.UNAUTHORIZED }));
    return;
  }
  res.json({
    message: 'Authenticated route example',
    userId: req.user.id,
    email: req.user.email,
  });
};
