import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../config/express';
import { sequelize, getAppModels } from '../db/models';
import * as sequelizeGlobal from '../config/sequelize';

describe('Auth starter', () => {
  beforeAll(async () => {
    sequelizeGlobal.init();
    await sequelize.sync({ force: true });
    await getAppModels().Role.create({ name: 'user' });
  });

  beforeEach(async () => {
    await getAppModels().User.destroy({ where: {}, truncate: true, restartIdentity: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('registers, logs in, returns me and protected ping', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'password12',
        first_name: 'E2E',
        last_name: 'User',
      })
      .expect(201);

    expect(registerRes.body.user.email).toBe('e2e@example.com');
    expect(registerRes.body.token).toBeDefined();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'password12' })
      .expect(200);

    const token = loginRes.body.token;
    expect(token).toBeDefined();

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.user.email).toBe('e2e@example.com');

    const pingRes = await request(app)
      .get('/api/v1/example/protected/ping')
      .set('Authorization', `JWT ${token}`)
      .expect(200);

    expect(pingRes.body.message).toBe('Authenticated route example');
  });

  it('rejects invalid login', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'password12' })
      .expect(401);
  });
});
