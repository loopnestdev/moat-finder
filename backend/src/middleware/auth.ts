import type { Request, Response, NextFunction } from 'express';
import { adminClient } from '../services/supabase';

/**
 * Verify the Supabase JWT from the Authorization: Bearer <token> header.
 * On success: populates req.user with { id, email, role } and calls next().
 * On failure: returns 401.
 *
 * Does NOT check role — use requireRole() middleware after this for role-gating.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice(7);

  const { data, error: authError } = await adminClient.auth.getUser(token);
  if (authError ?? !data.user) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    return;
  }

  const { data: userRow, error: dbError } = await adminClient
    .from('users')
    .select('id, email, role')
    .eq('id', data.user.id)
    .single();

  if (dbError ?? !userRow) {
    res.status(401).json({ error: 'User not found', code: 'UNAUTHORIZED' });
    return;
  }

  req.user = { id: userRow.id, email: userRow.email, role: userRow.role };
  next();
}
