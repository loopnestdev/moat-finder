import { describe, it, expect, afterEach } from 'vitest';
import type { Request } from 'express';
import { getClientIp } from '../src/utils/ip';

function makeReq(
  headers: Record<string, string | string[]> = {},
  remoteAddress = '127.0.0.1',
): Request {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as Request;
}

describe('getClientIp', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns the cf-connecting-ip header value', () => {
    const req = makeReq({ 'cf-connecting-ip': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('returns the first value when cf-connecting-ip is an array', () => {
    const req = makeReq({ 'cf-connecting-ip': ['1.2.3.4', '5.6.7.8'] });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to socket.remoteAddress in development when CF header is absent', () => {
    process.env.NODE_ENV = 'development';
    const req = makeReq({}, '10.0.0.1');
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('returns null in production when CF header is absent', () => {
    process.env.NODE_ENV = 'production';
    const req = makeReq({}, '10.0.0.1');
    expect(getClientIp(req)).toBeNull();
  });
});
