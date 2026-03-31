import type { Options } from 'sequelize';
import { Sequelize } from 'sequelize';
import { dbConfig } from '../../config/vars';
import type { AppModels } from '../../types/models';
import roleFactory from './role';
import userFactory from './user';

const sequelizeOptions: Options = {
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
};

if (dbConfig.dialect === 'sqlite') {
  sequelizeOptions.storage = dbConfig.storage || ':memory:';
} else {
  sequelizeOptions.host = dbConfig.host;
  sequelizeOptions.port = dbConfig.port;
}

export const sequelize = new Sequelize(
  dbConfig.database || 'auth_starter',
  dbConfig.username || 'postgres',
  dbConfig.password,
  sequelizeOptions,
);

roleFactory(sequelize);
userFactory(sequelize);

Object.keys(sequelize.models).forEach((modelName) => {
  const model = sequelize.models[modelName] as { associate?: (models: typeof sequelize.models) => void };
  if (model.associate) model.associate(sequelize.models);
});

/** Typed access to registered models (avoids `as any` at call sites) */
export function getAppModels(): AppModels {
  return sequelize.models as unknown as AppModels;
}

export const connectDatabase = async (): Promise<void> => {
  await sequelize.authenticate();
};

export const closeDatabase = async (): Promise<void> => {
  await sequelize.close();
};

export const isDatabaseReady = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
};
