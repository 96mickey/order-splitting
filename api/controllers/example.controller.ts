import type { Request, Response } from 'express';

/** Placeholder route until Order Splitter endpoints are added. */
export const ping = (_req: Request, res: Response): void => {
  res.json({ message: 'ok', service: 'order-splitter (skeleton)' });
};
