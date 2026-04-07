import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock supabase before importing anything that uses it
vi.mock('../src/services/supabase', () => ({
  adminClient: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
  anonClient: {},
}));

import { authenticate } from '../src/middleware/auth';
import { adminClient } from '../src/services/supabase';

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, headersSent: false } as unknown as Response & {
    status: typeof status;
    json: typeof json;
  };
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has wrong format', async () => {
    const req = makeReq({ authorization: 'Token abc123' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Supabase getUser returns an error', async () => {
    vi.mocked(adminClient.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT expired', name: 'AuthError', status: 401 } as never,
    });

    const req = makeReq({ authorization: 'Bearer invalid-token' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user row is not found in public.users', async () => {
    vi.mocked(adminClient.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'user-abc' } as never },
      error: null,
    });

    const queryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }),
    };
    vi.mocked(adminClient.from).mockReturnValue(queryChain as never);

    const req = makeReq({ authorization: 'Bearer valid-token' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('populates req.user and calls next() on a valid token', async () => {
    vi.mocked(adminClient.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'user-123' } as never },
      error: null,
    });

    const queryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({
        data: { id: 'user-123', email: 'test@example.com', role: 'approved' },
        error: null,
      }),
    };
    vi.mocked(adminClient.from).mockReturnValue(queryChain as never);

    const req = makeReq({ authorization: 'Bearer valid-token' });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(req.user).toEqual({ id: 'user-123', email: 'test@example.com', role: 'approved' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
