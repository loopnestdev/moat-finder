# moat-finder — Rebuild Prompt

This document contains the high-level prompt needed to recreate
moat-finder from scratch using an AI coding agent (e.g. Claude Code).

---

## What to Build

An AI-powered stock research web application that takes a stock ticker
as input and generates a structured investment research report in
3–8 minutes. The report scores the stock 1–10 on asymmetric
risk/reward and provides moat analysis, valuation, macro context,
and sentiment — all grounded in real-time web search.

The target user is an individual investor who wants institutional-grade
analysis without paying for Bloomberg or hiring an analyst.

---

## Architecture

User → Cloudflare (WAF + CDN + geo-block)
→ Cloudflare Pages (React SPA frontend)
→ Railway (Node.js/Express backend, Docker/Alpine)
→ Supabase (PostgreSQL + Auth + RLS)
→ Anthropic API (Claude with web_search)
→ Google Gemini API (Gemini with googleSearch)

**Frontend**: React + Vite + Tailwind CSS v4, hosted on Cloudflare Pages  
**Backend**: Node.js + Express + TypeScript, hosted on Railway  
**Database + Auth**: Supabase — Google OAuth, RLS on all tables  
**AI**: Claude (primary) + Gemini (secondary), user selects per run  
**Infrastructure**: Cloudflare for CDN/security, Railway for compute

---

## Key Features

### Research Pipeline (7 steps)

1. **Discovery** — company overview, sector, exchange, key facts
2. **Deep Dive** — business model, moat analysis, management rating
   (100-point A–F scorecard), technology assessment
3. **Valuation & Financials** — quarterly results, napkin math
   (3-scenario Bear/Base/Bull), peer comp table
4. **Risk Red Team** — bear case, key risks, short thesis
5. **Macro & Sector** — policy tailwinds/headwinds, sector heat
6. **Sentiment & Technicals** — insider activity, short interest,
   technical signals
7. **Synthesis** — final report JSON, investment score 1–10

Steps 2–6 run in **parallel** via `Promise.allSettled()`.  
Step 7 runs after all of 2–6 complete.  
Each completed step is **checkpointed** immediately — interrupted
pipelines resume from the last saved step.

### Multi-LLM Support

- Claude (Anthropic) — default, uses `web_search` tool
- Gemini (Google) — opt-in per run, uses `googleSearch` grounding
- Provider stored in `report_json.llm_provider` per report
- Model names configurable via env vars `CLAUDE_MODEL`, `GEMINI_MODEL`
- Full cross-provider checkpoint clearing on provider switch

### International Stock Support

- Ticker format: `SYMBOL.EXCHANGE` (e.g. `EOS.AX`, `7203.T`, `005930.KS`)
- Supported: ASX, TSE (Tokyo), KRX/KOSDAQ (Korea), HKEX, SGX, LSE,
  XETRA, Euronext, SIX, TSX, B3, NZX
- Exchange-aware prompts: currency, country, exchange name injected
  into all 7 steps
- Company name confirmation UI after Discovery to prevent wrong-company
  resolution on ambiguous tickers

### Report Sections

- Investment thesis (italic blockquote)
- Investment score gauge (1–10, colour-coded)
- Sector heat tags + emoji flames
- Business model diagram (custom canvas zones)
- Moat & competitors (parsed numbered list)
- Why Now — Catalysts (numbered cards)
- Napkin Math (target price + upside %, 3 scenarios)
- Quarterly earnings table
- Key Risks (red accent, white text)
- Bear case + rebuttal
- Macro & sector summary
- Sentiment & technicals
- Management Rating (independent A–F scorecard, 5 categories)
- Version history with diff + target price change

### Authentication & Access Control

- Google OAuth via Supabase (implicit flow, browser SPA)
- Role system: `admin`, `approved`, `pending`, `rejected`
- New users land as `pending` — admin approves via dashboard
- RLS on all tables — users can only read their own reports
- Admins can read all reports and delete any report

### Home Page

- Filter bar: Score ≥, Upside ≥ %, Sector (substring), Sort
- Stock cards show: ticker, score gauge, target price, upside %,
  first sector tag, LLM badge (✦ Claude / ◆ Gemini), date
- Count: "Showing X of Y stocks"

---

## Tech Stack Details

### Backend (Node.js/Express/TypeScript)

- `express` + `helmet` + `express-rate-limit`
- `@anthropic-ai/sdk` for Claude
- `@google/generative-ai` for Gemini
- `@supabase/supabase-js` for DB (service role key for admin ops)
- SSE (Server-Sent Events) for real-time pipeline progress
- `uuid` for run IDs, `dotenv` for env vars
- Docker/Alpine container on Railway

### Frontend (React/Vite/Tailwind v4)

- React + React Router v6
- Tailwind CSS v4 with `@theme {}` tokens
- Plus Jakarta Sans (weight 300 body, 700 headings)
- JetBrains Mono for all financial numbers
- Stripe-inspired dark theme: deep navy/purple backgrounds,
  gold `#d4a853` for financial accents
- Score colours: emerald (8–10), amber (5–7.9), red (1–4.9)

### Database (Supabase/PostgreSQL)

Tables: `users`, `tickers`, `research_reports`, `research_versions`,
`research_checkpoints`, `audit_log`

Key schema decisions:

- `research_reports.report_json` — full JSONB blob (all report data)
- `research_checkpoints` — per-step output saved immediately on completion
- `research_versions` — every update creates a new version with diff_json
- RLS reads role from `auth.jwt()` app_metadata (not a subquery — avoids
  infinite recursion)

### Infrastructure

- **Cloudflare**: WAF, Bot Fight Mode, geo-restrict to AU only,
  Cloudflare Pages for frontend
- **Railway**: backend container, auto-deploy on `main` push,
  `asia-southeast1` region
- **UptimeRobot**: pings Railway every 5 min to prevent cold starts
- **Supabase**: free tier for DB + auth, service role key kept
  server-side only

---

## Environment Variables

### Backend (Railway)

```
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-5
GEMINI_MODEL=gemini-2.5-flash
DEFAULT_LLM=claude
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=https://your-domain.com
NODE_ENV=production
PORT=  (auto-set by Railway)
```

### Frontend (Cloudflare Pages)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=https://your-backend.railway.app
```

---

## Known Implementation Notes

- **Tailwind v4**: uses `@import "tailwindcss"` and `@theme {}` blocks
  in `index.css`. `tailwind.config.ts` is ignored in v4.
- **Google OAuth**: use implicit flow (not PKCE) for browser SPAs.
  PKCE is for server-side flows.
- **SSE + Cloudflare**: set `X-Accel-Buffering: no` header to prevent
  Cloudflare from buffering SSE. Send keepalive pings every 30s.
- **Railway trust proxy**: set `app.set('trust proxy', 1)` before any
  middleware — required for `express-rate-limit` behind Cloudflare.
- **JSON extraction**: Claude/Gemini sometimes wrap output in
  `{"report": {...}}` or include `{TICKER}` in prose before JSON.
  Use depth-tracking brace matching, not `indexOf('{')`.
- **Checkpoint clearing on provider switch**: when updating a Gemini
  report with Claude (or vice versa), clear ALL checkpoints first —
  mixed provider data in synthesis produces inconsistent JSON.
- **Management rating schema**: strictly enforce the 5-category schema
  in the Step 2 prompt. Gemini will invent alternative schemas if not
  constrained.

---

## Spec Documents (in repo)

- `CLAUDE.md` — master briefing for Claude Code autonomous operation
- `docs/ARCHITECTURE.md` — system design, pipeline detail, SSE protocol
- `docs/DATABASE.md` — all table schemas, RLS policies, report_json shape
- `docs/FEATURES.md` — product requirements
- `backend/CLAUDE.md` — backend subsystem rules
- `frontend/CLAUDE.md` — frontend subsystem rules
