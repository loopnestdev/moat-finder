# ARCHITECTURE.md — moat-finder

## System Overview

moat-finder is a fullstack web application that researches stock tickers using the
Claude API with live web search, stores results in Supabase, and renders structured
investment reports with interactive business model diagrams.

---

## Traffic Flow (Request Lifecycle)

```
Browser / Mobile
      │
      ▼
┌─────────────────────────────┐
│         Cloudflare          │  ← DDoS, bot detection, rate limiting,
│  (DNS proxy, geo-blocking)  │    SSL termination, AU-only geo rule,
│                             │    CF-Connecting-IP header injected
└─────────────┬───────────────┘
              │
     ┌────────┴────────┐
     │                 │
     ▼                 ▼
┌──────────────┐  ┌───────────────┐
│  Cloudflare  │  │    Railway    │
│   Workers    │  │ (Express API) │
│ (React SPA)  │  │  /api/v1/*    │
└──────────────┘  └──────┬────────┘
                         │
            ┌────────────┼─────────────┐
            │            │             │
            ▼            ▼             ▼
      ┌──────────┐ ┌──────────┐ ┌──────────────-┐
      │ Supabase │ │ Supabase │ │ Anthropic API │
      │ Postgres │ │   Auth   │ │ claude-sonnet │
      │  + RLS   │ │          │ │  + web_search │
      └──────────┘ └──────────┘ └──────────────-┘
                                  │
                              ┌───┴──────────────------┐
                              │   Google Gemini        │
                              │ gemini-2.5-flash-lite  │
                              │  + googleSearch        │
                              └──────────────────------┘
```

---

## Cloudflare Configuration

- **DNS**: Domain A/CNAME records proxied through Cloudflare (orange cloud ON)
- **Geo-blocking**: Firewall rule — block all traffic where `ip.geoip.country != "AU"`
- **Rate limiting**: 60 requests/minute per IP on `/api/v1/research/*`
- **Bot Fight Mode**: Enabled
- **SSL**: Full (strict) mode — end-to-end encryption
- **Real IP**: `CF-Connecting-IP` header passed to Express; backend reads this header
  for all IP logging — never use `req.ip` directly

---

## Frontend (Cloudflare Workers)

- **Framework**: React 19 + Vite + TypeScript strict
- **Styling**: Tailwind CSS v4 — mobile-first, responsive
- **Routing**: React Router v7 — client-side routing
- **Diagrams**: Pure React/Tailwind 4-zone stacked canvas (React Flow removed)
- **Auth**: Supabase Auth JS v2 — handles session, OAuth redirects
- **State**: React Query (TanStack Query) v5 for server state; React Context for auth state
- **Streaming**: EventSource (SSE) to consume streaming research pipeline responses
- **Deployment**: `wrangler deploy` — assets served from Cloudflare Workers edge network

### Cloudflare Workers Configuration (`wrangler.jsonc`)

```jsonc
{
  "name": "moat-finder",
  "compatibility_date": "2026-04-11",
  "observability": { "enabled": true },
  "assets": {
    "not_found_handling": "single-page-application", // SPA fallback routing
  },
  "compatibility_flags": ["nodejs_compat"],
}
```

### Frontend Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=        # points to Railway backend URL
```

---

## Backend (Railway)

- **Runtime**: Node.js v22 LTS + Express + TypeScript
- **Build**: Docker multi-stage build (`node:22-alpine` builder + lean runner)
- **Transpilation**: tsx for dev, tsc for production build
- **Port**: 3001 (local), Railway assigns port via `process.env.PORT`
- **Routes**: All prefixed `/api/v1/`
- **Auth middleware**: Verifies Supabase JWT on every protected route
- **CORS**: Restricted to Cloudflare Workers frontend origin only
- **Streaming**: Server-Sent Events (SSE) for research pipeline progress
- **IP logging**: Always read `req.headers['cf-connecting-ip']` — fall back to
  `req.socket.remoteAddress` for local dev only
- **Binding**: Express must bind to `0.0.0.0` (not `127.0.0.1`) — Railway routes
  external traffic to the container; `127.0.0.1` silently breaks health checks

### Railway Configuration (`railway.toml`)

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 120
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Dockerfile (multi-stage, `node:22-alpine`)

```
Stage 1 — builder: npm ci + tsc compile
Stage 2 — runner:  non-root user (nodejs:1001), production deps only, HEALTHCHECK
```

### Backend Environment Variables

```
PORT=3001
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only, never exposed to client
ANTHROPIC_API_KEY=           # runtime API key for research pipeline
NODE_ENV=development|production
FRONTEND_ORIGIN=             # CORS allowlist (Cloudflare Workers URL)
```

### Route Map

```
GET    /api/v1/health                    # health check (public)
GET    /api/v1/research/:ticker          # fetch cached report (public)
GET    /api/v1/research                  # list all researched tickers (public)
POST   /api/v1/research/:ticker          # trigger new research (auth required)
PUT    /api/v1/research/:ticker          # trigger update + diff (auth required)
GET    /api/v1/research/:ticker/versions # list version history (public)
GET    /api/v1/audit                     # fetch audit log (admin only)
GET    /api/v1/admin/users               # list users pending approval (admin only)
PATCH  /api/v1/admin/users/:id           # approve/reject user (admin only)
```

---

## AI Research Pipeline v2 (7 Steps)

The pipeline runs server-side only. Each step calls the Anthropic API with
`web_search` enabled. Steps are sequential — each step's output feeds context
into the next. Results stream back to the frontend via SSE as each step completes.

```
Step 1 — DISCOVERY
  Input:  ticker symbol
  Task:   Identify company name, industry, top 3 competitors (with tickers),
          top 3 known customers, primary product/service, primary region,
          platform classification (platform vs single-product),
          platform optionality (adjacent TAMs), re-rating catalyst
  Output: JSON — populates all [PLACEHOLDER] variables for steps 2–7

Step 2 — DEEP DIVE
  Input:  Step 1 output
  Task:   Business model, moat analysis, technological advantage,
          upcoming catalysts (12-month horizon)
  Output: Narrative sections + structured data

Step 3 — VALUATION & FINANCIALS
  Input:  Step 1 + 2 output
  Task:   Relative valuation table vs competitors (growth-stage matched),
          Rule of 40, P/S history, insider ownership, SBC as % revenue,
          three valuation scenarios (Bear/Base/Bull), quarterly results
  Comp rule: if subject >50% YoY growth, ≥2 comps must be >30% YoY
  Output: Structured tables + 3-scenario napkin math

Step 4 — RISK RED TEAM
  Input:  Step 1–3 output
  Task:   Bear case (structural risks only, not temporary overhangs),
          SEC risk factors, tail risks, bear case rebuttal
  Cap:    4 web searches max, < 800 words — prevents 600+ second runs
  Output: Structured risk assessment + bear_case_rebuttal

Step 5 — MACRO & SECTOR
  Input:  Step 1 output + hot sector list
  Task:   Policy impacts, tariff exposure, government contracts,
          supply chain risks, sector heat check
  Hot sectors: Energy, Power, AI, Space, Nuclear, Semiconductor, Robotics, Solar
  Output: Macro section + sector heat score (1–5)

Step 6 — SENTIMENT & TECHNICALS
  Input:  Step 1 output
  Task:   Short interest, implied volatility, retail sentiment,
          200-day MA position, RS vs SPY
  Output: Sentiment summary

Step 7 — SYNTHESIS
  Input:  Steps 1–6 complete output
  Task:   Generate final report:
          - Score (1.0–10.0, one decimal) with weighted rubric
          - One-liner thesis
          - Business model narrative
          - Moat & competitors
          - Napkin math (Base scenario target price)
          - All 3 scenarios array (Bear/Base/Bull)
          - Bear case + rebuttal
          - Sector heat (1–5)
          - Platform type + optionality
          - Re-rating catalyst
  Output: Structured JSON report saved to Supabase
```

### Scoring Rubric (Step 7)

| Factor             | Weight |
| ------------------ | ------ |
| Sector momentum    | 20%    |
| Growth velocity    | 25%    |
| Valuation vs peers | 20%    |
| Moat quality       | 20%    |
| Execution risk     | 15%    |

**Special rules:**

- Company >50% YoY growth + genuine moat: minimum score 4.5 even if temporary overhangs exist
- `platform_type == "platform"` + 2+ adjacent markets in `platform_optionality`: +0.5 bonus
- `napkin_math.target_price` must mirror the Base scenario — never use Bear as the headline

### Scenarios Array Format

```json
"scenarios": [
  { "label": "Bear", "comp_ticker": "XYZ", "comp_multiple": 4.2, "target_price": 8.50, "upside_percent": -15, "rationale": "..." },
  { "label": "Base", "comp_ticker": "ABC", "comp_multiple": 7.8, "target_price": 18.00, "upside_percent": 80, "rationale": "..." },
  { "label": "Bull", "comp_ticker": "DEF", "comp_multiple": 12.0, "target_price": 27.00, "upside_percent": 170, "rationale": "..." }
]
```

---

## Authentication & Authorisation

- **Provider**: Supabase Auth
- **Federated logins**: Google OAuth (configured in Supabase dashboard)
- **Session**: JWT stored in Supabase client (httpOnly cookie pattern)
- **User approval flow**:
  1. User registers via OAuth
  2. Account created with `status = 'pending'` in `public.users` table
  3. Admin reviews pending users in frontend admin panel
  4. Admin approves → `status = 'approved'`; rejects → `status = 'rejected'`
  5. Only `approved` users can trigger research or updates
- **Roles**: `admin`, `approved`, `pending`, `rejected`
- **RLS**: All Supabase tables have Row Level Security enabled.
  Service role key used only for admin operations server-side.
  Anon key used for public read operations.

---

## Caching Strategy

- Every researched ticker is stored in Supabase with full report JSON
- Public users (unauthenticated) can read any cached report — no API cost
- Cache hit check happens BEFORE any AI pipeline call
- `updated_at` timestamp shown on every report
- Authenticated users can trigger update — creates new version, stores diff

---

## Deployment Pipeline

```
git push origin main
        │
        ├──► GitHub Actions detects changes
        │         ├──► frontend/ changes → wrangler deploy → Cloudflare Workers
        │         └──► backend/ changes  → Railway builds Docker image + deploys
        │
        └──► Manual deploy (alternative):
                  ├──► frontend/: npm run build && npm run deploy
                  └──► backend/:  railway up
```

Environment variables are set in each platform's dashboard — never in code.

- **Cloudflare Workers**: set via `wrangler secret put` or Cloudflare dashboard Workers > Settings > Variables
- **Railway**: set via Railway dashboard project > Variables

---

## Local Development

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev

# Supabase — use local Supabase CLI or point to hosted project
```

`.env` files required:

- `backend/.env` — copy from `backend/.env.example`
- `frontend/.env.local` — copy from `frontend/.env.example`
