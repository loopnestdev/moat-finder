-- Immutable history of every version of every report. Never update or delete rows.
CREATE TABLE public.research_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_id       UUID NOT NULL REFERENCES public.tickers(id) ON DELETE CASCADE,
  ticker_symbol   TEXT NOT NULL,
  version         INTEGER NOT NULL,
  score           NUMERIC(3,1),
  report_json     JSONB NOT NULL,
  diagram_json    JSONB NOT NULL,
  diff_json       JSONB,            -- null for version 1; populated for v2+
  researched_by   UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ticker_id, version)
);

CREATE INDEX idx_versions_ticker ON public.research_versions(ticker_id, version DESC);

ALTER TABLE public.research_versions ENABLE ROW LEVEL SECURITY;

-- Public: SELECT allowed
CREATE POLICY "research_versions_public_select" ON public.research_versions
  FOR SELECT
  USING (true);

-- Authenticated approved: INSERT allowed (on update trigger only)
CREATE POLICY "research_versions_approved_insert" ON public.research_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

-- Admin: full access
CREATE POLICY "research_versions_admin_all" ON public.research_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
