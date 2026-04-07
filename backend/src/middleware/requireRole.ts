import type { Request, Response, NextFunction } from 'express';

/**
 * Role-based access control middleware factory.
 *
 * requireRole('approved') — allows users with role 'approved' or 'admin'
 * requireRole('admin')    — allows only users with role 'admin'
 *
 * Must be used after the authenticate middleware (depends on req.user).
 * Returns 403 { error, code } if the role requirement is not met.
 */
export function requireRole(minimum: 'approved' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;

    if (minimum === 'admin') {
      if (role !== 'admin') {
        res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
        return;
      }
    } else {
      if (role !== 'approved' && role !== 'admin') {
        res.status(403).json({ error: 'Account not approved', code: 'NOT_APPROVED' });
        return;
      }
    }

    next();
  };
}
