import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('roles', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      name: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      created_at: { allowNull: false, type: DataTypes.DATE },
      updated_at: { allowNull: false, type: DataTypes.DATE },
    });

    await queryInterface.createTable('users', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      first_name: { type: DataTypes.STRING(128), allowNull: true },
      last_name: { type: DataTypes.STRING(128), allowNull: true },
      is_active: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: true },
      role_id: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: { allowNull: false, type: DataTypes.DATE },
      updated_at: { allowNull: false, type: DataTypes.DATE },
    });

    await queryInterface.bulkInsert('roles', [{ name: 'user', created_at: new Date(), updated_at: new Date() }]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('roles');
  },
};
