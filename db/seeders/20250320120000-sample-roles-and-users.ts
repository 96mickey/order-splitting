import bcrypt from 'bcrypt';
import { QueryInterface, Op } from 'sequelize';

const SAMPLE_PASSWORD = 'password12';

interface RoleRow {
  id: number;
  name: string;
}

module.exports = {
  async up(queryInterface: QueryInterface) {
    const now = new Date();
    const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 10);

    await queryInterface.sequelize.query(`
      INSERT INTO roles (name, created_at, updated_at)
      SELECT 'admin', :now, :now
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');
    `, { replacements: { now } });

    const [roleRows] = await queryInterface.sequelize.query("SELECT id, name FROM roles WHERE name IN ('user', 'admin');");
    const rows = roleRows as RoleRow[];
    const roleByName = Object.fromEntries(rows.map((r) => [r.name, r.id])) as Record<'user' | 'admin', number>;
    if (roleByName.user === undefined || roleByName.admin === undefined) {
      throw new Error('Expected roles "user" and "admin" to exist before seeding users.');
    }

    const users = [
      { email: 'demo.user@example.com', password_hash: passwordHash, first_name: 'Demo', last_name: 'User', is_active: true, role_id: roleByName.user, created_at: now, updated_at: now },
      { email: 'admin@example.com', password_hash: passwordHash, first_name: 'Sample', last_name: 'Admin', is_active: true, role_id: roleByName.admin, created_at: now, updated_at: now },
    ];

    await Promise.all(users.map((u) => queryInterface.sequelize.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active, role_id, created_at, updated_at)
      SELECT :email, :password_hash, :first_name, :last_name, :is_active, :role_id, :created_at, :updated_at
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = :email);
    `, { replacements: u })));
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete('users', { email: { [Op.in]: ['demo.user@example.com', 'admin@example.com'] } });
    await queryInterface.bulkDelete('roles', { name: 'admin' });
  },
};
