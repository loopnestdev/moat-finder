import type { Request } from 'express';

/**
 * Extract the real client IP address.
 * In production: reads CF-Connecting-IP injected by Cloudflare.
 * In development: falls back to the socket remote address.
 * Never use req.ip directly — it does not reflect the real IP behind Cloudflare.
 */
export function getClientIp(req: Request): string | null {
  const cf = req.headers['cf-connecting-ip'];
  if (cf !== undefined) {
    return Array.isArray(cf) ? (cf[0] ?? null) : cf;
  }
  if (process.env.NODE_ENV !== 'production') {
    return req.socket.remoteAddress ?? null;
  }
  return null;
}
