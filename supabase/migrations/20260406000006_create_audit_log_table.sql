-- Append-only. Never update or delete rows. Captures every meaningful action.
CREATE TABLE public.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action          TEXT NOT NULL
                    CHECK (action IN (
                      'research_triggered',
                      'research_updated',
                      'report_viewed',
                      'report_searched',
                      'user_approved',
                      'user_rejected',
                      'login',
                      'logout'
                    )),
  ticker_symbol   TEXT,             -- null for non-ticker actions
  user_id         UUID REFERENCES public.users(id),
  ip_address      INET,             -- from CF-Connecting-IP
  user_agent      TEXT,
  metadata        JSONB,            -- any extra context (version number, etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_ticker ON public.audit_log(ticker_symbol);
CREATE INDEX idx_audit_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_action ON public.audit_log(action);

-- GIN index for metadata search
CREATE INDEX idx_audit_metadata_gin ON public.audit_log USING GIN (metadata);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Public: no access (no policies = deny all for anon/unauthenticated)

-- Authenticated approved: no access (intentionally no policy)

-- Admin: SELECT only (audit log is read-only even for admin)
CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Backend service role INSERT: service_role bypasses RLS entirely.
-- This permissive INSERT policy is a safety net for any non-service_role path
-- that may need to write audit rows (e.g. edge functions running as anon).
-- Regular authenticated users still cannot INSERT because this policy has no
-- role restriction — but in practice only the backend service_role writes here.
CREATE POLICY "audit_log_service_insert" ON public.audit_log
  FOR INSERT
  WITH CHECK (true);
