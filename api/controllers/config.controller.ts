import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { getConfigSnapshot, setMaxDecimalPlaces } from '../../order-splitter/runtime-config';

export const getConfig = (_req: Request, res: Response): void => {
  res.status(httpStatus.OK).json(getConfigSnapshot());
};

export const patchConfig = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { maxDecimalPlaces } = req.body as { maxDecimalPlaces: number };
    setMaxDecimalPlaces(maxDecimalPlaces);
    res.status(httpStatus.OK).json(getConfigSnapshot());
  } catch (e) {
    next(e);
  }
};
