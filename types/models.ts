/* eslint-disable camelcase -- DB/API field names match underscored Sequelize schema */
import type { Model, ModelStatic, Optional } from 'sequelize';

/** Persisted role row */
export interface RoleAttributes {
  id: number;
  name: string;
}

export type RoleCreationAttributes = Optional<RoleAttributes, 'id'>;

/** Sequelize Role row instance (column fields + Model methods) */
export interface RoleInstance extends Model<RoleAttributes, RoleCreationAttributes>, RoleAttributes {}

export type RoleModel = ModelStatic<RoleInstance>;

/** Persisted user row */
export interface UserAttributes {
  id: number;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  role_id: number;
}

export type UserCreationAttributes = Optional<UserAttributes, 'id' | 'is_active'>;

/**
 * User instance with optional eager-loaded Role and JWT helper.
 */
export interface UserInstance extends Model<UserAttributes, UserCreationAttributes>, UserAttributes {
  Role?: RoleInstance;
  issueAccessToken(role?: RoleInstance): string;
}

export type UserModel = ModelStatic<UserInstance>;

/** Models registered on the app Sequelize instance (names match `sequelize.define` names) */
export interface AppModels {
  User: UserModel;
  Role: RoleModel;
}

/** `sequelize.define` return value plus optional `associate` hook */
export type AssociableModelStatic<M extends Model> = ModelStatic<M> & {
  associate?(models: AppModels): void;
};

/** Safe JSON shape returned from auth endpoints */
export interface PublicUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role?: string;
}
