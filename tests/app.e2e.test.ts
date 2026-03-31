import request from 'supertest';
import app from '../config/express';

describe('HTTP skeleton', () => {
  it('returns healthz', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns readyz when Redis is disabled', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.checks.redis).toBe('disabled');
  });

  it('returns example ping', async () => {
    const res = await request(app).get('/api/v1/example/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('ok');
  });
});
