import type { Request } from 'express';
import { adminClient } from '../services/supabase';
import { getClientIp } from '../utils/ip';
import type { AuditAction } from '../types/report.types';
import type { Json } from '../types/database.types';

/**
 * Write a row to public.audit_log via the admin (service role) client.
 * Never throws — audit failures must not break the enclosing request.
 */
export async function logAudit(
  action: AuditAction,
  req: Request,
  extras?: { ticker_symbol?: string; metadata?: Json },
): Promise<void> {
  try {
    const ipAddress = getClientIp(req);
    await adminClient.from('audit_log').insert({
      action,
      ticker_symbol: extras?.ticker_symbol ?? null,
      user_id: req.user?.id ?? null,
      // ip_address column is INET in Postgres; typed as unknown in generated types
      ip_address: ipAddress as unknown,
      user_agent: req.headers['user-agent'] ?? null,
      metadata: extras?.metadata ?? null,
    });
  } catch {
    // Intentionally swallowed — audit failures must not break the request
  }
}
