import type { Sequelize } from 'sequelize';
import type { AppModels } from '../types/models';
import { sequelize } from '../db/models';

export const init = (): void => {
  global.sequelize = {
    Database1: sequelize as Sequelize & { models: AppModels },
  };
};
