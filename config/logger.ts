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

function buildTransports(): winston.transport[] {
  const list: winston.transport[] = [
    new winston.transports.Console({
      format: logConfig.prettyConsole ? consoleFormat : jsonFormat,
    }),
  ];

  const rotateOpts = {
    dirname: logConfig.logDir,
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: jsonFormat,
  };

  list.push(
    new DailyRotateFile({
      ...rotateOpts,
      filename: 'error-%DATE%.log',
      level: 'error',
    }),
  );

  if (logConfig.logRotatingFiles) {
    list.push(
      new DailyRotateFile({
        ...rotateOpts,
        filename: 'combined-%DATE%.log',
      }),
      new DailyRotateFile({
        ...rotateOpts,
        filename: 'http-%DATE%.log',
      }),
    );
  }

  return list;
}

export const logger = winston.createLogger({
  level: logConfig.level,
  format: jsonFormat,
  defaultMeta: { service: logConfig.serviceName },
  transports: buildTransports(),
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
