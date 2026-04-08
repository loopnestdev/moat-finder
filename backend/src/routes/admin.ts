import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { logAudit } from '../middleware/audit';
import { adminClient } from '../services/supabase';

const router = Router();

// Apply auth + admin role to all routes in this file
router.use(authenticate, requireRole('admin'));

// ─── GET /api/v1/admin/users ─────────────────────────────────────────────────

const userRoleFilter = z.enum(['admin', 'approved', 'pending', 'rejected']).optional();

router.get('/admin/users', async (req, res) => {
  try {
    const roleResult = userRoleFilter.safeParse(req.query.role);
    if (req.query.role !== undefined && !roleResult.success) {
      res.status(400).json({ error: 'Invalid role filter', code: 'INVALID_PARAMS' });
      return;
    }

    let query = adminClient
      .from('users')
      .select('id, email, display_name, avatar_url, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (roleResult.success && roleResult.data !== undefined) {
      query = query.eq('role', roleResult.data);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: 'Failed to fetch users', code: 'DB_ERROR' });
      return;
    }

    res.json({ data: data ?? [] });
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── PATCH /api/v1/admin/users/:id ───────────────────────────────────────────

const patchUserSchema = z.object({
  role: z.enum(['approved', 'rejected']),
});

router.patch('/admin/users/:id', async (req, res) => {
  try {
    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'role must be "approved" or "rejected"', code: 'INVALID_PARAMS' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Missing user id', code: 'INVALID_PARAMS' });
      return;
    }

    const { error } = await adminClient
      .from('users')
      .update({ role: parsed.data.role })
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: 'Failed to update user', code: 'DB_ERROR' });
      return;
    }

    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      app_metadata: { role: parsed.data.role },
    });

    if (authError) {
      res.status(500).json({ error: 'Failed to update user auth metadata', code: 'DB_ERROR' });
      return;
    }

    const action = parsed.data.role === 'approved' ? 'user_approved' : 'user_rejected';
    void logAudit(action, req, { metadata: { target_user_id: id } });

    res.json({ data: { id, role: parsed.data.role } });
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/v1/audit ───────────────────────────────────────────────────────

const auditQuerySchema = z.object({
  ticker: z.string().optional(),
  user_id: z.string().optional(),
  action: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

router.get('/audit', async (req, res) => {
  try {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', code: 'INVALID_PARAMS' });
      return;
    }

    const { ticker, user_id, action, date_from, date_to, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticker) query = query.eq('ticker_symbol', ticker);
    if (user_id) query = query.eq('user_id', user_id);
    if (action) query = query.eq('action', action);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: 'Failed to fetch audit log', code: 'DB_ERROR' });
      return;
    }

    res.json({ data: data ?? [], count: count ?? 0, page, limit });
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

export default router;
