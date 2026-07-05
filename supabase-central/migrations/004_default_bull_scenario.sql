-- ============================================================
-- Default the home page's "headline" numbers to the Bull scenario
-- instead of Base.
-- Run this in the coredb Supabase Dashboard -> SQL Editor
-- Safe to re-run: DROP COLUMN / CREATE OR REPLACE / IF NOT EXISTS
-- throughout.
--
-- target_price and upside_percent previously mirrored napkin_math
-- (the pipeline's Base-scenario headline figure). They now mirror
-- the Bull entry in report_json.scenarios instead, falling back to
-- napkin_math for pre-v2 reports that have no scenarios array.
-- napkin_math itself is untouched — it still means Base internally
-- (used by NapkinMath.tsx's "Base" option and Scenarios.tsx) and the
-- Step 3 pipeline prompt is unchanged. Only these two summary
-- columns (used for home page cards + sort/filter) change meaning.
--
-- Postgres generated columns can't be ALTERed in place — the column
-- must be dropped and re-added.
-- ============================================================

-- Reusable regex-guarded numeric cast — a single malformed LLM value
-- (non-numeric string, stray text) returns NULL instead of failing
-- the whole generated-column expression for every row.
CREATE OR REPLACE FUNCTION moat.safe_numeric(val TEXT) RETURNS NUMERIC
IMMUTABLE
LANGUAGE sql
AS $$
  SELECT CASE WHEN val ~ '^-?[0-9]+(\.[0-9]+)?$' THEN val::numeric ELSE NULL END;
$$;

ALTER TABLE moat.research_reports DROP COLUMN IF EXISTS target_price;
ALTER TABLE moat.research_reports DROP COLUMN IF EXISTS upside_percent;

-- scenarios is documented to always be ordered [Bear, Base, Bull], but
-- this checks the label at each of the 3 positions explicitly rather
-- than assuming index 2 — robust if the LLM ever returns a different
-- order.
ALTER TABLE moat.research_reports
  ADD COLUMN target_price NUMERIC
  GENERATED ALWAYS AS (
    moat.safe_numeric(
      COALESCE(
        CASE
          WHEN report_json->'scenarios'->0->>'label' = 'Bull' THEN report_json->'scenarios'->0->>'target_price'
          WHEN report_json->'scenarios'->1->>'label' = 'Bull' THEN report_json->'scenarios'->1->>'target_price'
          WHEN report_json->'scenarios'->2->>'label' = 'Bull' THEN report_json->'scenarios'->2->>'target_price'
        END,
        report_json->'napkin_math'->>'target_price'
      )
    )
  ) STORED;

ALTER TABLE moat.research_reports
  ADD COLUMN upside_percent NUMERIC
  GENERATED ALWAYS AS (
    moat.safe_numeric(
      COALESCE(
        CASE
          WHEN report_json->'scenarios'->0->>'label' = 'Bull' THEN report_json->'scenarios'->0->>'upside_percent'
          WHEN report_json->'scenarios'->1->>'label' = 'Bull' THEN report_json->'scenarios'->1->>'upside_percent'
          WHEN report_json->'scenarios'->2->>'label' = 'Bull' THEN report_json->'scenarios'->2->>'upside_percent'
        END,
        report_json->'napkin_math'->>'upside_percent'
      )
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_moat_research_upside ON moat.research_reports(upside_percent DESC NULLS LAST);
