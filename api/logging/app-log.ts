import { logger } from '../../config/logger';
import type { AppLog, LogMeta } from '../../types/logging';

function write(level: 'error' | 'warn' | 'info' | 'debug', message: string, meta?: LogMeta): void {
  logger.log(level, { scope: 'app', ...(meta ?? {}), message });
}

/**
 * Manual / module-level logging (not tied to HTTP). Use `req.log` inside route handlers when possible.
 */
export const appLog: AppLog = {
  error(message, meta) {
    write('error', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  info(message, meta) {
    write('info', message, meta);
  },
  debug(message, meta) {
    write('debug', message, meta);
  },
};
