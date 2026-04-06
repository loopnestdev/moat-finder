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
┌─────────┐      ┌───────────────┐
│ Vercel  │      │    Render     │
│(React   │ ───► │ (Express API) │
│frontend)│      │  /api/v1/*    │
└─────────┘      └──────┬────────┘
                        │
           ┌────────────┼─────────────┐
           │            │             │
           ▼            ▼             ▼
     ┌──────────┐ ┌──────────┐ ┌──────────────┐
     │ Supabase │ │ Supabase │ │ Anthropic API │
     │ Postgres │ │   Auth   │ │ claude-sonnet │
     │  + RLS   │ │          │ │  + web_search │
     └──────────┘ └──────────┘ └──────────────┘
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

## Frontend (Vercel)

- **Framework**: React 18 + Vite + TypeScript strict
- **Styling**: Tailwind CSS v3 — mobile-first, responsive
- **Routing**: React Router v6
- **Diagrams**: React Flow — interactive node-based business model diagrams
- **Auth**: Supabase Auth JS client — handles session, OAuth redirects
- **State**: React Query (TanStack Query) for server state; React Context for auth state
- **Streaming**: EventSource (SSE) to consume streaming research pipeline responses
- **Build output**: Static assets deployed to Vercel CDN

### Frontend Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=        # points to Render backend
```

---

## Backend (Render)

- **Runtime**: Node.js v20 LTS + Express + TypeScript
- **Transpilation**: tsx for dev, tsc for production build
- **Port**: 3001 (local), Render assigns port via `process.env.PORT`
- **Routes**: All prefixed `/api/v1/`
- **Auth middleware**: Verifies Supabase JWT on every protected route
- **CORS**: Restricted to Vercel frontend origin only
- **Streaming**: Server-Sent Events (SSE) for research pipeline progress
- **IP logging**: Always read `req.headers['cf-connecting-ip']` — fall back to
  `req.socket.remoteAddress` for local dev only

### Backend Environment Variables

```
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only, never exposed to client
ANTHROPIC_API_KEY=           # runtime API key for research pipeline
NODE_ENV=development|production
FRONTEND_ORIGIN=             # CORS allowlist
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

## AI Research Pipeline (Sequential — 7 Steps)

The pipeline runs server-side only. Each step calls the Anthropic API with
`web_search` enabled. Steps are sequential — each step's output feeds context
into the next. Results stream back to the frontend via SSE as each step completes.

```
Step 1 — DISCOVERY
  Input:  ticker symbol
  Task:   Identify company name, industry, top 3 competitors (with tickers),
          top 3 known customers, primary product/service, primary region
  Output: JSON — populates all [PLACEHOLDER] variables for steps 2–7

Step 2 — DEEP DIVE
  Input:  Step 1 output
  Task:   Business model, moat analysis, technological advantage,
          upcoming catalysts (12-month horizon)
  Output: Narrative sections + structured data

Step 3 — VALUATION & FINANCIALS
  Input:  Step 1 + 2 output
  Task:   Relative valuation table vs competitors, Rule of 40, P/S history,
          insider ownership, SBC as % revenue, institutional holders,
          cash burn, revenue estimates
  Output: Structured tables + narrative

Step 4 — RISK RED TEAM
  Input:  Step 1–3 output
  Task:   Bear case (3-point short report), tail risks, SEC risk factors,
          earnings miss history, customer concentration, dilution history
  Output: Structured risk assessment

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

Step 7 — SYNTHESIS & DIAGRAM SPEC
  Input:  Steps 1–6 complete output
  Task:   Generate final report in moat-finder format:
          - Score (1.0–10.0, one decimal)
          - One-liner thesis
          - Business model narrative
          - Moat & competitors
          - Napkin math (valuation upside)
          - Bear case
          - Sector heat (1–5)
          - React Flow diagram spec (JSON nodes + edges)
            showing: revenue streams → business units → customers → moat
  Output: Structured JSON report saved to Supabase
```

### React Flow Diagram Spec Format (output of Step 7)

```json
{
  "nodes": [
    { "id": "1", "type": "revenue", "label": "Revenue Stream", "amount": "$200M" },
    { "id": "2", "type": "moat",    "label": "DMEA 1A Clearance" },
    { "id": "3", "type": "customer","label": "US Dept of Defense" }
  ],
  "edges": [
    { "source": "1", "target": "3", "label": "serves" },
    { "source": "2", "target": "1", "label": "protects" }
  ]
}
```

Node types: `revenue` (green), `moat` (orange), `customer` (blue),
`risk` (red), `business_unit` (purple)

---

## Authentication & Authorisation

- **Provider**: Supabase Auth
- **Federated logins**: Google, Apple, Twitter/X (configured in Supabase dashboard)
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
        ├──► Vercel detects frontend/ changes → builds + deploys automatically
        │
        └──► Render detects backend/ changes → builds + deploys automatically
```

Both Vercel and Render are connected to the GitHub repository.
Environment variables are set in each platform's dashboard — never in code.

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
