import { DataTypes, Sequelize } from 'sequelize';
import type { AppModels, AssociableModelStatic, RoleInstance } from '../../types/models';

export default (sequelize: Sequelize) => {
  const Role = sequelize.define<RoleInstance>(
    'Role',
    {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      name: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    },
    { tableName: 'roles', underscored: true },
  ) as AssociableModelStatic<RoleInstance>;

  Role.associate = (models: AppModels) => {
    Role.hasMany(models.User, { foreignKey: 'role_id', as: 'users' });
  };

  return Role;
};
