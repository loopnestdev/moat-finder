-- ============================================================
-- Add filterable/sortable columns to moat.research_reports for
-- server-side pagination + filtering on the home page list.
-- Run this in the coredb Supabase Dashboard -> SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
--
-- upside_percent / target_price / sector_heat / yoy_growth are
-- GENERATED STORED columns derived from report_json, so they can
-- never drift out of sync with the source of truth. Each cast is
-- guarded by a numeric regex check so a single malformed LLM
-- value (non-numeric string, stray text) can't fail the whole
-- ALTER TABLE for every row.
--
-- hot_sector_match is a plain (non-generated) text[] column —
-- Postgres generated columns disallow subqueries, and turning a
-- jsonb array into text[] needs jsonb_array_elements_text(), so
-- this one is backfilled once here and written explicitly by the
-- app on every insert/update going forward (see saveResearch.ts
-- and the PUT /:ticker route).
-- ============================================================

ALTER TABLE moat.research_reports
  ADD COLUMN IF NOT EXISTS upside_percent NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN (report_json->'napkin_math'->>'upside_percent') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (report_json->'napkin_math'->>'upside_percent')::numeric
      ELSE NULL
    END
  ) STORED;

ALTER TABLE moat.research_reports
  ADD COLUMN IF NOT EXISTS target_price NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN (report_json->'napkin_math'->>'target_price') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (report_json->'napkin_math'->>'target_price')::numeric
      ELSE NULL
    END
  ) STORED;

ALTER TABLE moat.research_reports
  ADD COLUMN IF NOT EXISTS sector_heat NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN (report_json->>'sector_heat') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (report_json->>'sector_heat')::numeric
      ELSE NULL
    END
  ) STORED;

-- Mirrors the frontend's normPct() guard (lib/normPct.ts): the LLM may
-- return yoy_growth as a decimal (0.25) or an already-multiplied
-- percentage (25) — if scaling by 100 would exceed 200%, the value was
-- already a percentage.
ALTER TABLE moat.research_reports
  ADD COLUMN IF NOT EXISTS yoy_growth NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN (report_json->'valuation_table'->0->>'yoy_growth') !~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN NULL
      WHEN abs((report_json->'valuation_table'->0->>'yoy_growth')::numeric * 100) > 200
        THEN (report_json->'valuation_table'->0->>'yoy_growth')::numeric
      ELSE (report_json->'valuation_table'->0->>'yoy_growth')::numeric * 100
    END
  ) STORED;

ALTER TABLE moat.research_reports
  ADD COLUMN IF NOT EXISTS hot_sector_match TEXT[];

-- One-time backfill for existing rows — going forward the app writes
-- this column explicitly on every insert/update.
UPDATE moat.research_reports
SET hot_sector_match = ARRAY(
  SELECT jsonb_array_elements_text(report_json->'hot_sector_match')
)
WHERE hot_sector_match IS NULL;

CREATE INDEX IF NOT EXISTS idx_moat_research_upside      ON moat.research_reports(upside_percent DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_moat_research_sector_heat ON moat.research_reports(sector_heat DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_moat_research_yoy_growth  ON moat.research_reports(yoy_growth DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_moat_research_hot_sector  ON moat.research_reports USING GIN (hot_sector_match);
