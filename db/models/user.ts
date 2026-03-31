import jwt from 'jsonwebtoken';
import { DataTypes, Sequelize } from 'sequelize';
import { jwtConfig } from '../../config/vars';
import type { AppModels, AssociableModelStatic, RoleInstance, UserInstance } from '../../types/models';

export default (sequelize: Sequelize) => {
  const User = sequelize.define<UserInstance>(
    'User',
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      first_name: { type: DataTypes.STRING(128), allowNull: true },
      last_name: { type: DataTypes.STRING(128), allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      role_id: { type: DataTypes.INTEGER, allowNull: false },
    },
    { tableName: 'users', underscored: true },
  ) as AssociableModelStatic<UserInstance>;

  User.associate = (models: AppModels) => {
    User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'Role' });
  };

  (User.prototype as UserInstance).issueAccessToken = function issueAccessToken(
    this: UserInstance,
    role?: RoleInstance,
  ): string {
    const r = role || this.Role;
    const roleName = r ? r.name : 'user';
    return jwt.sign(
      { sub: this.id, email: this.email, role: roleName },
      jwtConfig.secret,
      {
        algorithm: jwtConfig.algo,
        expiresIn: `${jwtConfig.expiryMinutes}m`,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      },
    );
  };

  return User;
};
