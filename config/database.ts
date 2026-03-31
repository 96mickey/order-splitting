import path from 'path';
import dotenvSafe from 'dotenv-safe';

dotenvSafe.config({
  path: path.join(__dirname, '../.env'),
  sample: path.join(__dirname, '../.env.example'),
  allowEmptyValues: true,
});

const common = {
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME,
  host: process.env.DATABASE_HOST,
  port: Number.parseInt(process.env.DATABASE_PORT || '5432', 10),
  dialect: process.env.DATABASE_DIALECT || 'postgres',
  storage: process.env.DATABASE_STORAGE,
};

export = {
  development: common,
  test: common,
  production: common,
};
