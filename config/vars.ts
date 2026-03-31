import path from 'path';
import dotenvSafe from 'dotenv-safe';

dotenvSafe.config({
  path: path.join(__dirname, '../.env'),
  sample: path.join(__dirname, '../.env.example'),
  allowEmptyValues: true,
});

export const env = process.env.NODE_ENV || 'development';
export const port = Number.parseInt(process.env.PORT || '3010', 10);

const asBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

const asInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const dbConfig = {
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD ?? '',
  host: process.env.DATABASE_HOST,
  port: asInt(process.env.DATABASE_PORT, 5432),
  dialect: (process.env.DATABASE_DIALECT || 'postgres') as 'postgres' | 'sqlite',
  storage: process.env.DATABASE_STORAGE,
  logging: asBool(process.env.SQL_LOGGING, false) ? console.log : false,
};

export const jwtConfig = {
  algo: 'HS256' as const,
  secret: process.env.JWT_SECRET || 'change-me',
  expiryMinutes: asInt(process.env.JWT_EXPIRATION_MINUTES, 60),
  issuer: process.env.JWT_ISSUER || 'auth-starter',
  audience: process.env.JWT_AUDIENCE || 'auth-starter-clients',
};

export const bcryptRounds = asInt(process.env.BCRYPT_ROUNDS, 10);
export const defaultRoleName = process.env.DEFAULT_ROLE_NAME || 'user';

const corsOrigin = process.env.CORS_ORIGIN || '*';

export const serverConfig = {
  trustProxy: asBool(process.env.TRUST_PROXY, false),
};

export const corsConfig = {
  enabled: asBool(process.env.CORS_ENABLED, true),
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
  credentials: asBool(process.env.CORS_CREDENTIALS, true),
};

export const rateLimitConfig = {
  enabled: asBool(process.env.RATE_LIMIT_ENABLED, true),
  scope: (process.env.RATE_LIMIT_SCOPE || 'global') as 'global' | 'api',
  windowMs: asInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  max: asInt(process.env.RATE_LIMIT_MAX, 100),
};

export const redisConfig = {
  enabled: asBool(process.env.REDIS_ENABLED, false),
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: asInt(process.env.REDIS_PORT, 6379),
  password: process.env.REDIS_PASSWORD,
  db: asInt(process.env.REDIS_DB, 0),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'auth-starter:',
};

const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const allowedLevels = new Set(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']);

export const logConfig = {
  level: allowedLevels.has(logLevel) ? logLevel : 'info',
  serviceName: process.env.SERVICE_NAME || 'auth-starter',
  logDir: process.env.LOG_DIR || './logs',
  prettyConsole: asBool(process.env.LOG_PRETTY_CONSOLE, env === 'development'),
  httpLogBody: asBool(process.env.LOG_HTTP_BODY, true),
  httpLogHeaders: asBool(process.env.LOG_HTTP_HEADERS, true),
};
