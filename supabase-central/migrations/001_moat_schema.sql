-- ============================================================
-- moat-finder schema migration for coredb (lcqsatefkutiakhgexue)
-- Run this in the coredb Supabase Dashboard → SQL Editor
-- All moat-finder tables live in the `moat` schema.
-- ============================================================

-- ── Schema ───────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS moat;

-- Grant usage to Supabase built-in roles
GRANT USAGE ON SCHEMA moat TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA moat
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA moat
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA moat
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;


-- ── Trigger function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION moat.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── users ─────────────────────────────────────────────────────
-- Extends auth.users with moat-finder-specific role management.
CREATE TABLE IF NOT EXISTS moat.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (role IN ('admin', 'approved', 'pending', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moat_users_role ON moat.users(role);

CREATE OR REPLACE TRIGGER set_users_updated_at
  BEFORE UPDATE ON moat.users
  FOR EACH ROW EXECUTE FUNCTION moat.set_updated_at();

ALTER TABLE moat.users ENABLE ROW LEVEL SECURITY;

-- Authenticated user: can read own row only
CREATE POLICY "moat_users_select_own" ON moat.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admin: full read/write on all rows
CREATE POLICY "moat_users_admin_all" ON moat.users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );


-- ── tickers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moat.tickers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol               TEXT NOT NULL UNIQUE,
  company_name         TEXT,
  industry             TEXT,
  sector               TEXT,
  first_researched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_researched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  research_count       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_moat_tickers_symbol ON moat.tickers(symbol);

ALTER TABLE moat.tickers ENABLE ROW LEVEL SECURITY;

-- Public: SELECT only
CREATE POLICY "moat_tickers_public_select" ON moat.tickers
  FOR SELECT USING (true);

-- Authenticated approved: INSERT
CREATE POLICY "moat_tickers_approved_insert" ON moat.tickers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

-- Admin: full access
CREATE POLICY "moat_tickers_admin_all" ON moat.tickers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );


-- ── research_reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moat.research_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_id       UUID NOT NULL REFERENCES moat.tickers(id) ON DELETE CASCADE,
  ticker_symbol   TEXT NOT NULL,
  score           NUMERIC(3,1) CHECK (score >= 1.0 AND score <= 10.0),
  report_json     JSONB NOT NULL,
  diagram_json    JSONB NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  researched_by   UUID REFERENCES moat.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ticker_id)
);

CREATE INDEX IF NOT EXISTS idx_moat_research_ticker_symbol ON moat.research_reports(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_moat_research_score         ON moat.research_reports(score DESC);
CREATE INDEX IF NOT EXISTS idx_moat_research_updated       ON moat.research_reports(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_moat_research_report_gin    ON moat.research_reports USING GIN (report_json);

CREATE OR REPLACE TRIGGER set_research_reports_updated_at
  BEFORE UPDATE ON moat.research_reports
  FOR EACH ROW EXECUTE FUNCTION moat.set_updated_at();

ALTER TABLE moat.research_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moat_research_reports_public_select" ON moat.research_reports
  FOR SELECT USING (true);

CREATE POLICY "moat_research_reports_approved_insert" ON moat.research_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

CREATE POLICY "moat_research_reports_approved_update" ON moat.research_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

CREATE POLICY "moat_research_reports_admin_all" ON moat.research_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );


-- ── research_versions ─────────────────────────────────────────
-- Immutable history — never update or delete rows.
CREATE TABLE IF NOT EXISTS moat.research_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_id       UUID NOT NULL REFERENCES moat.tickers(id) ON DELETE CASCADE,
  ticker_symbol   TEXT NOT NULL,
  version         INTEGER NOT NULL,
  score           NUMERIC(3,1),
  report_json     JSONB NOT NULL,
  diagram_json    JSONB NOT NULL,
  diff_json       JSONB,
  researched_by   UUID REFERENCES moat.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ticker_id, version)
);

CREATE INDEX IF NOT EXISTS idx_moat_versions_ticker ON moat.research_versions(ticker_id, version DESC);

ALTER TABLE moat.research_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moat_research_versions_public_select" ON moat.research_versions
  FOR SELECT USING (true);

CREATE POLICY "moat_research_versions_approved_insert" ON moat.research_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

CREATE POLICY "moat_research_versions_admin_all" ON moat.research_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );


-- ── audit_log ─────────────────────────────────────────────────
-- Append-only. Never update or delete rows.
CREATE TABLE IF NOT EXISTS moat.audit_log (
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
  ticker_symbol   TEXT,
  user_id         UUID REFERENCES moat.users(id),
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moat_audit_created      ON moat.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moat_audit_ticker        ON moat.audit_log(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_moat_audit_user          ON moat.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_moat_audit_action        ON moat.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_moat_audit_metadata_gin  ON moat.audit_log USING GIN (metadata);

ALTER TABLE moat.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin: SELECT only (read-only even for admin)
CREATE POLICY "moat_audit_log_admin_select" ON moat.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM moat.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Service role writes audit rows (bypasses RLS). Safety-net policy below:
CREATE POLICY "moat_audit_log_service_insert" ON moat.audit_log
  FOR INSERT WITH CHECK (true);


-- ── research_checkpoints ──────────────────────────────────────
-- Temporary pipeline step outputs. Cleared after successful save.
CREATE TABLE IF NOT EXISTS moat.research_checkpoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_symbol TEXT NOT NULL,
  run_id        UUID NOT NULL,
  step_number   INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 7),
  step_label    TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  output_json   JSONB NOT NULL,
  tokens_used   INTEGER,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ticker_symbol, run_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_moat_checkpoints_ticker ON moat.research_checkpoints(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_moat_checkpoints_run    ON moat.research_checkpoints(run_id);

ALTER TABLE moat.research_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moat_checkpoints_service_role_only" ON moat.research_checkpoints
  FOR ALL TO service_role USING (true);
