import { randomUUID } from 'crypto';
import type { Request } from 'express';
import winston, { type Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { logConfig } from './vars';

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    if (stack) return `${timestamp} ${level}: ${message}${metaStr}\n${stack}`;
    return `${timestamp} ${level}: ${message}${metaStr}`;
  }),
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: logConfig.level,
  format: jsonFormat,
  defaultMeta: { service: logConfig.serviceName },
  transports: [
    new winston.transports.Console({
      format: logConfig.prettyConsole ? consoleFormat : jsonFormat,
    }),
    new DailyRotateFile({
      filename: 'error-%DATE%.log',
      dirname: logConfig.logDir,
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: 'combined-%DATE%.log',
      dirname: logConfig.logDir,
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: 'http-%DATE%.log',
      dirname: logConfig.logDir,
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
  ],
});

export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId, scope: 'http' });
}

/**
 * Prefer `req.log` in handlers; use this when `req` is partial or from a catch block.
 */
export function getRequestLogger(req: Pick<Request, 'log' | 'requestId'>): Logger {
  if (req.log) return req.log;
  return logger.child({ requestId: req.requestId ?? randomUUID() });
}
