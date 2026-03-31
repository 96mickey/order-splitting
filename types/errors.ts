import type { CelebrateError } from 'celebrate';
import type { ValidationErrorItem } from 'joi';

/** Flatten Joi validation items from Celebrate's per-segment map */
export function extractCelebrateValidationItems(err: CelebrateError): ValidationErrorItem[] {
  if (!err.details) return [];
  return Array.from(err.details.values()).flatMap((validationError) => validationError.details ?? []);
}

/** Narrow unknown errors in middleware */
export interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  errors?: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface JsonErrorBody {
  code: number;
  message: string;
  errors?: string[];
  stack?: string;
}
