CREATE TABLE public.research_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker_id       UUID NOT NULL REFERENCES public.tickers(id) ON DELETE CASCADE,
  ticker_symbol   TEXT NOT NULL,
  score           NUMERIC(3,1) CHECK (score >= 1.0 AND score <= 10.0),
  report_json     JSONB NOT NULL,   -- full structured report from Step 7
  diagram_json    JSONB NOT NULL,   -- React Flow nodes + edges from Step 7
  version         INTEGER NOT NULL DEFAULT 1,
  researched_by   UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ticker_id)  -- one current report per ticker
);

CREATE INDEX idx_research_ticker_symbol ON public.research_reports(ticker_symbol);
CREATE INDEX idx_research_score ON public.research_reports(score DESC);
CREATE INDEX idx_research_updated ON public.research_reports(updated_at DESC);

-- GIN index for full-text search on report_json
CREATE INDEX idx_research_report_gin ON public.research_reports USING GIN (report_json);

CREATE TRIGGER set_research_reports_updated_at
  BEFORE UPDATE ON public.research_reports
  FOR EACH ROW EXECUTE FUNCTION moatfinder_set_updated_at();

ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

-- Public: SELECT allowed (cached reports are public)
CREATE POLICY "research_reports_public_select" ON public.research_reports
  FOR SELECT
  USING (true);

-- Authenticated approved: INSERT allowed
CREATE POLICY "research_reports_approved_insert" ON public.research_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

-- Authenticated approved: UPDATE allowed
CREATE POLICY "research_reports_approved_update" ON public.research_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

-- Admin: full access
CREATE POLICY "research_reports_admin_all" ON public.research_reports
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
