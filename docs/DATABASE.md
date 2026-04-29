# DATABASE.md — moat-finder

## Provider

Supabase (managed Postgres). Row Level Security (RLS) enabled on ALL tables.
Never disable RLS. Never expose the service role key to the frontend.

---

## Tables

### `public.users`

Extends Supabase's `auth.users`. Stores approval status and role.

```sql
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (role IN ('admin', 'approved', 'pending', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_users_role ON public.users(role);

-- Auto-update updated_at
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION moatfinder_set_updated_at();
```

**RLS Policies:**

- Public: no read access
- Authenticated user: can read own row only
- Admin: full read/write on all rows

---

### `public.tickers`

Master list of every ticker that has ever been researched.

```sql
CREATE TABLE public.tickers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          TEXT NOT NULL UNIQUE,   -- e.g. 'SKYT', always uppercase
  company_name    TEXT,
  industry        TEXT,
  sector          TEXT,
  first_researched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_researched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  research_count  INTEGER NOT NULL DEFAULT 0
);

-- Index
CREATE INDEX idx_tickers_symbol ON public.tickers(symbol);
```

**RLS Policies:**

- Public: SELECT only (anyone can see the list of researched tickers)
- Authenticated approved: INSERT allowed when triggering new research
- Admin: full access

---

### `public.research_reports`

Stores the latest (current) research report for each ticker. One row per ticker.

```sql
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

-- Indexes
CREATE INDEX idx_research_ticker_symbol ON public.research_reports(ticker_symbol);
CREATE INDEX idx_research_score ON public.research_reports(score DESC);
CREATE INDEX idx_research_updated ON public.research_reports(updated_at DESC);

-- GIN index for full-text search on report_json
CREATE INDEX idx_research_report_gin ON public.research_reports USING GIN (report_json);
```

**report_json shape:**

```json
{
  "thesis": "string",
  "business_model": "string",
  "moat": "string",
  "competitors": [{ "ticker": "string", "name": "string" }],
  "napkin_math": {
    "revenue_guidance": "string",
    "comp_ticker": "string",
    "comp_multiple": "number",
    "target_price": "number",
    "upside_percent": "number"
  },
  "bear_case": "string",
  "sector_heat": "number",
  "hot_sector_match": ["string"],
  "valuation_table": [{}],
  "catalysts": ["string"],
  "risk_factors": ["string"],
  "macro_summary": "string",
  "sentiment_summary": "string",
  "pipeline_steps_raw": {},
  "llm_provider": "claude | gemini",
  "llm_model": "claude-sonnet-4-6 | gemini-2.5-flash-lite",
  "management_rating": {
    "grade": "A | B | C | D | F",
    "score": "number (0–100)",
    "summary": "string",
    "ceo_assessment": "string",
    "recent_changes": "string",
    "capital_allocation": "string"
  }
}
```

**RLS Policies:**

- Public: SELECT allowed (cached reports are public)
- Authenticated approved: INSERT, UPDATE allowed
- Admin: full access

---

### `public.research_versions`

Immutable history of every version of every report. Never update or delete rows.

```sql
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

-- Indexes
CREATE INDEX idx_versions_ticker ON public.research_versions(ticker_id, version DESC);
```

**diff_json shape:**

```json
{
  "score": { "from": 7.2, "to": 8.1 },
  "changed_fields": ["thesis", "napkin_math.target_price", "bear_case"],
  "added_catalysts": ["string"],
  "removed_catalysts": ["string"],
  "summary": "Human-readable summary of what changed"
}
```

**RLS Policies:**

- Public: SELECT allowed
- Authenticated approved: INSERT allowed (on update trigger only)
- Admin: full access

---

### `public.research_checkpoints`

Temporary per-step checkpoint storage for pipeline resume support. Rows are cleared
automatically after a pipeline run completes and saves successfully to `research_reports`.

```sql
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
```

**RLS Policies:**

- Public: no access
- Authenticated: no access
- Backend service role: full access (INSERT, SELECT, DELETE only)

**Lifecycle:**

1. Each step saves its output immediately on completion via `saveCheckpoint()`
2. On restart, `loadCheckpoints()` finds the most recent `run_id` for a ticker and replays completed steps
3. After the final report is written to `research_reports`, `clearCheckpoints()` deletes the run rows

---

### `public.audit_log`

Append-only. Never update or delete rows. Captures every meaningful action.

```sql
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

-- Indexes
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_ticker ON public.audit_log(ticker_symbol);
CREATE INDEX idx_audit_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_action ON public.audit_log(action);

-- GIN index for metadata search
CREATE INDEX idx_audit_metadata_gin ON public.audit_log USING GIN (metadata);
```

**RLS Policies:**

- Public: no access
- Authenticated approved: no access
- Admin: SELECT only (audit log is read-only even for admin)
- Backend service role: INSERT only (never update/delete)

---

## Shared Database Function

```sql
-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION moatfinder_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## RLS Summary Table

| Table                | Public | Approved User        | Admin  |
| -------------------- | ------ | -------------------- | ------ |
| users                | none   | own row only         | all    |
| tickers              | SELECT | SELECT+INSERT        | all    |
| research_reports     | SELECT | SELECT+INSERT+UPDATE | all    |
| research_versions    | SELECT | SELECT+INSERT        | all    |
| research_checkpoints | none   | none                 | none   |
| audit_log            | none   | none                 | SELECT |

---

## Migration Strategy

- All schema changes via Supabase migration files in `supabase/migrations/`
- Never alter tables manually in the dashboard — always write a migration file
- Migration file naming: `YYYYMMDDHHMMSS_description.sql`
- Run locally with Supabase CLI: `supabase db push`

---

## TypeScript Types

Generate types from schema using Supabase CLI:

```bash
npx supabase gen types typescript --project-id <project-id> > backend/src/types/database.types.ts
```

Re-run whenever schema changes. Commit the generated file.
