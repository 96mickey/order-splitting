import type { Sequelize } from 'sequelize';
import type { AppModels } from './models';

declare global {
  /**
   * Legacy shape: single logical DB as `Database1` (matches older codebase layout).
   * `models` is narrowed to our registered models.
   */
  // eslint-disable-next-line no-var
  var sequelize: {
    Database1: Sequelize & { models: AppModels };
  };
}

export {};
