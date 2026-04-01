import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../../config/express';
import { buildHttpAccessLogMessage, httpRequestLogger } from '../../api/middlewares/http-log';

const accessLineRe = /^\[[A-Z]+ .+\] requestId=[\w-]+ latency=[\d.]+ms status=\d{3}$/;

type MockResWithFinish = {
  res: Pick<Response, 'statusCode' | 'get' | 'on'>;
  emitFinish: () => void;
};

function mockResponseWithFinish(): MockResWithFinish {
  const finishFns: Array<() => void> = [];
  const res = {
    statusCode: 200,
    get: vi.fn(),
    on: vi.fn((event: string, fn: () => void) => {
      if (event === 'finish') finishFns.push(fn);
    }),
  } as unknown as Pick<Response, 'statusCode' | 'get' | 'on'>;
  return {
    res,
    emitFinish: () => {
      finishFns.forEach((f) => f());
    },
  };
}

describe('buildHttpAccessLogMessage', () => {
  it('matches the bracket access-line shape', () => {
    const req = {
      method: 'GET',
      originalUrl: '/healthz?x=1',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    } as Pick<Request, 'method' | 'originalUrl' | 'requestId'>;
    const msg = buildHttpAccessLogMessage(req, 200, 12.345);
    expect(msg).toBe(
      '[GET /healthz?x=1] requestId=550e8400-e29b-41d4-a716-446655440000 latency=12.35ms status=200',
    );
    expect(msg).toMatch(accessLineRe);
  });
});

describe('httpRequestLogger middleware', () => {
  it('logs exactly one bracket info line on finish for 2xx', () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const { res, emitFinish } = mockResponseWithFinish();
    res.statusCode = 200;

    const req = {
      method: 'GET',
      originalUrl: '/healthz',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      path: '/healthz',
      query: {},
      params: {},
      ip: '127.0.0.1',
      get: vi.fn(),
      body: undefined,
      route: undefined,
      log: { info, warn, error },
    } as unknown as Request;

    httpRequestLogger(req, res as Response, vi.fn() as NextFunction);
    emitFinish();

    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    const msg = info.mock.calls[0][0] as string;
    expect(msg).toMatch(accessLineRe);
    expect(msg).toContain('status=200');
  });

  it('logs one bracket warn line on finish for 4xx', () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const { res, emitFinish } = mockResponseWithFinish();
    res.statusCode = 404;

    const req = {
      method: 'GET',
      originalUrl: '/missing',
      requestId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      path: '/missing',
      query: {},
      params: {},
      ip: undefined,
      get: vi.fn(),
      body: undefined,
      route: undefined,
      log: { info, warn, error },
    } as unknown as Request;

    httpRequestLogger(req, res as Response, vi.fn() as NextFunction);
    emitFinish();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect((warn.mock.calls[0][0] as string).match(accessLineRe)).toBeTruthy();
    expect(warn.mock.calls[0][0] as string).toContain('status=404');
  });
});

describe('HTTP error JSON', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('404 JSON body includes top-level requestId aligned with header', async () => {
    const res = await request(app).get('/no-such-route-for-request-id-test');
    expect(res.status).toBe(404);
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});
