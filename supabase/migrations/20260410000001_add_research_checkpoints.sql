CREATE TABLE public.research_checkpoints (
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

CREATE INDEX idx_checkpoints_ticker ON public.research_checkpoints(ticker_symbol);
CREATE INDEX idx_checkpoints_run    ON public.research_checkpoints(run_id);

ALTER TABLE public.research_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.research_checkpoints
  FOR ALL TO service_role USING (true);
