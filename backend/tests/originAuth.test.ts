import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { originAuthorized, requireOriginAuth } from '../src/middleware/originAuth';

describe('originAuthorized', () => {
  it('allows everything when no secret is configured', () => {
    expect(originAuthorized(undefined, undefined)).toBe(true);
    expect(originAuthorized('anything', '  \n')).toBe(true);
  });

  it('requires the exact secret when one is configured', () => {
    expect(originAuthorized('s3cret', 's3cret')).toBe(true);
    expect(originAuthorized('s3creT', 's3cret')).toBe(false);
    expect(originAuthorized('s3cret-longer', 's3cret')).toBe(false);
    expect(originAuthorized(undefined, 's3cret')).toBe(false);
    expect(originAuthorized(['s3cret', 's3cret'], 's3cret')).toBe(false);
  });

  it('ignores surrounding whitespace, e.g. a trailing newline from pbcopy', () => {
    expect(originAuthorized('s3cret', 's3cret\n')).toBe(true);
    expect(originAuthorized(' s3cret ', 's3cret')).toBe(true);
  });
});

describe('requireOriginAuth', () => {
  function run(path: string, header?: string) {
    const req = { path, headers: header === undefined ? {} : { 'x-origin-auth': header } } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();
    requireOriginAuth(req, { status } as unknown as Response, next);
    return { next, status };
  }

  afterEach(() => {
    delete process.env.ORIGIN_AUTH_SECRET;
  });

  it('passes every request while ORIGIN_AUTH_SECRET is unset', () => {
    expect(run('/api/v1/research/AAPL').next).toHaveBeenCalled();
  });

  it('rejects a request without the header with 403', () => {
    process.env.ORIGIN_AUTH_SECRET = 's3cret';
    const { next, status } = run('/api/v1/research/AAPL');
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('passes a request carrying the secret', () => {
    process.env.ORIGIN_AUTH_SECRET = 's3cret';
    expect(run('/api/v1/research/AAPL', 's3cret').next).toHaveBeenCalled();
  });

  it('exempts the health check', () => {
    process.env.ORIGIN_AUTH_SECRET = 's3cret';
    expect(run('/api/v1/health').next).toHaveBeenCalled();
  });
});
