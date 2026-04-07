CREATE TABLE public.tickers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol               TEXT NOT NULL UNIQUE,   -- e.g. 'SKYT', always uppercase
  company_name         TEXT,
  industry             TEXT,
  sector               TEXT,
  first_researched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_researched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  research_count       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_tickers_symbol ON public.tickers(symbol);

ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;

-- Public: SELECT only (anyone can see the list of researched tickers)
CREATE POLICY "tickers_public_select" ON public.tickers
  FOR SELECT
  USING (true);

-- Authenticated approved: INSERT allowed when triggering new research
CREATE POLICY "tickers_approved_insert" ON public.tickers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('approved', 'admin')
    )
  );

-- Admin: full access (UPDATE + DELETE)
CREATE POLICY "tickers_admin_all" ON public.tickers
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
