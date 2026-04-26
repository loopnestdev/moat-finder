# CLAUDE.md — moat-finder

---

## Project Purpose

A web application that takes an input of a stock ticker and generates a detailed AI-powered research
report about the company — focused on finding asymmetric risk/reward opportunities.

---

## Architecture

| Layer            | Tools                                       | Notes                                                                           |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Frontend         | React 19 + Vite + Tailwind CSS v4           | Dark navy / cream / gold design system                                          |
| Frontend hosting | Cloudflare Workers                          | SPA routing via `not_found_handling: single-page-application` in wrangler.jsonc |
| Backend          | Node.js v22 + Express 4 + TypeScript strict |                                                                                 |
| Backend hosting  | Railway                                     | Docker multi-stage build (railway.toml + Dockerfile)                            |
| Security layer   | CloudFlare                                  | DDoS, rate limiting, SSL, CF-Connecting-IP                                      |
| Auth             | Supabase Auth (Google OAuth)                | Role-based: admin / approved / pending / rejected                               |
| Database         | Supabase (Postgres) with RLS                |                                                                                 |
| Diagram          | Pure React / Tailwind (React Flow removed)  | 4-zone stacked canvas                                                           |
| AI               | Claude claude-sonnet-4-6 + web_search tool  | 7-step pipeline (v2)                                                            |

---

## Hard Constraints

1. **Minimize external dependencies** — standard libraries only where possible.
2. **Modular approach** — frontend, backend, AI pipeline are separate concerns.
3. **Security is always number one priority** — hardened, no secrets in frontend.
4. **CloudFlare sits in front of everything** — CF-Connecting-IP for real IP logging. Cloudflare proxies all traffic to Cloudflare Workers (frontend) and Railway (backend API).
5. **Mobile-first design** — all Tailwind classes written mobile-first with `sm:`, `md:`, `lg:` prefixes.
6. **Auth-gated research** — only approved users may trigger new research or updates.
7. **Public read access** — cached reports are publicly viewable without login.
8. **Update with diff/changelog** — update button runs smart pipeline (skips unchanged steps) and shows diff before saving.
9. **Audit logging** — every action logged with user, IP, ticker, timestamp.
10. **No inline styles** — all styling via Tailwind utility classes only. No `style={{}}` except SVG attributes.

---

## File Layout

```
moat-finder/
├── CLAUDE.md                    # Master briefing (this file)
├── README.md                    # Project README with architecture diagram + deployment guide
├── docs/
│   ├── ARCHITECTURE.md          # System design
│   ├── DATABASE.md              # Schema source of truth
│   ├── FEATURES.md              # Product requirements
│   └── architecture.drawio      # draw.io architecture diagram (open at app.diagrams.net)
├── backend/
│   ├── CLAUDE.md                # Backend-specific rules
│   ├── Dockerfile               # Multi-stage build: node:22-alpine builder + runner
│   ├── railway.toml             # Railway deploy config (healthcheck, restart policy)
│   └── src/
│       ├── routes/
│       │   ├── research.ts      # GET/POST/PUT research endpoints
│       │   └── admin.ts         # Admin user management
│       ├── services/
│       │   ├── pipeline.ts      # 7-step AI research pipeline (v2)
│       │   ├── diff.ts          # Report diff/changelog generator
│       │   └── supabase.ts      # anon + service-role clients
│       └── types/
│           └── report.types.ts  # Shared pipeline + report types
├── frontend/
│   ├── CLAUDE.md                # Frontend-specific rules
│   ├── wrangler.jsonc           # Cloudflare Workers deploy config
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx         # Ticker search + grid
│       │   ├── Report.tsx       # Full report page (two-column layout)
│       │   ├── Versions.tsx     # Version history
│       │   └── Admin.tsx        # Admin panel
│       ├── components/
│       │   ├── layout/          # Nav.tsx, Layout.tsx
│       │   ├── report/          # ScoreBadge, SectorHeat, ValuationTable,
│       │   │                    # NapkinMath, BearCase, Changelog,
│       │   │                    # BusinessDiagram, QuarterlyResults
│       │   ├── research/        # PipelineProgress, DiffModal
│       │   ├── ui/              # Button, Input, Modal, Badge, Spinner
│       │   └── ErrorBoundary.tsx
│       └── types/
│           └── report.types.ts  # Frontend mirrors of backend types
└── .claude/
    ├── settings.json            # Hooks configuration (PreToolUse, PostToolUse, Stop)
    ├── hooks/
    │   ├── track-doc-changes.sh # PostToolUse: appends edited .ts/.tsx paths to pending-doc-updates.txt
    │   ├── remind-doc-update.sh # Stop: prints CLAUDE.md update reminder if pending-doc-updates.txt exists
    │   ├── block-dangerous.sh   # PreToolUse/Bash: blocks destructive shell commands
    │   ├── log-commands.sh      # PreToolUse/Bash: logs all bash commands run by Claude
    │   ├── protect-files.sh     # PreToolUse/Edit|Write: prevents edits to protected files
    │   ├── require-tests-for-pr.sh  # PreToolUse: blocks PR creation if tests are missing
    │   └── auto-commit.sh       # Stop: auto-commits if configured
    └── skills/                  # Reusable Claude skills
```

---

## Claude Code Hooks

Hooks are configured in `.claude/settings.json` and run automatically around tool calls.

| Hook                      | Trigger                                     | Purpose                                                                                               |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `block-dangerous.sh`      | PreToolUse/Bash                             | Blocks `rm -rf`, force-push, and other destructive commands                                           |
| `log-commands.sh`         | PreToolUse/Bash                             | Logs every shell command Claude runs (audit trail)                                                    |
| `protect-files.sh`        | PreToolUse/Edit,Write                       | Prevents edits to `.env`, `database.types.ts`, and other protected files                              |
| `require-tests-for-pr.sh` | PreToolUse/mcp**github**create_pull_request | Blocks PR creation if no test files exist for changed source                                          |
| `track-doc-changes.sh`    | PostToolUse/Edit,Write                      | Appends edited `.ts`/`.tsx` file paths to `.claude/pending-doc-updates.txt`                           |
| `remind-doc-update.sh`    | Stop                                        | If `pending-doc-updates.txt` has entries, prints a reminder box listing changed files, then clears it |
| `auto-commit.sh`          | Stop                                        | Auto-commits staged changes if configured                                                             |
| Prettier + ESLint         | PostToolUse/Edit,Write                      | Auto-formats and auto-fixes each edited file immediately after write                                  |

**Important**: `track-doc-changes.sh` only tracks `.ts`/`.tsx` files. It will NOT fire when `.sh`, `.md`, `.json`, or other config files change. If those files change in a way that affects architecture, pitfalls, or rules, update the relevant CLAUDE.md files manually.

---

## Language & Runtime

- TypeScript strict mode throughout — no `any` types, ever
- Node.js v22 LTS (backend, Dockerfile uses `node:22-alpine`)
- Package manager: npm

## Commands

```bash
# Backend (from backend/)
npm run dev        # tsx watch — port 3001
npm run build      # tsc compile
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
npm run start      # node dist/index.js (production)

# Frontend (from frontend/)
npm run dev        # Vite dev server — port 5173
npm run build      # Vite production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run deploy     # wrangler deploy (Cloudflare Workers production deploy)
```

## How Claude Verifies Changes

1. `npm run typecheck` — zero errors in both frontend/ and backend/
2. `npm run build` — must pass in frontend/
3. `npm run build` — must pass in backend/
4. Never leave failing type errors. Fix before moving on.

---

## Key Decisions & Architecture Notes

- **Pipeline execution**: Step 1 (Discovery) runs first; Steps 2-6 run concurrently via `Promise.allSettled`; Step 7 synthesises. Smart updates (`runUpdatePipeline`) skip Steps 2 and 4, reusing cached report data.
- **Prompt caching**: Steps 2-6 send Step 1 output as a cached content block (`cache_control: { type: "ephemeral" }`), reducing input tokens by ~60-70% across parallel calls.
- **SSE streaming**: Progress events streamed to frontend as each step completes. Step status can be `complete`, `error`, or `cached`.
- **Supabase clients**: `anonClient` for user-facing reads (RLS enforced). `adminClient` (service role) for writes and admin operations only.
- **API keys**: `.env` files only — never hardcoded, never committed.
- **All backend routes**: prefixed `/api/v1/`.
- **CF-Connecting-IP**: used for real IP in audit logs — never `req.ip`.
- **React Flow**: removed. Business diagram is now a pure React/Tailwind 4-zone stacked canvas (moat → business → customers → risks).
- **Font stack**: Playfair Display (headings / `font-display`), Inter (body / `font-body`), JetBrains Mono (data / `font-mono`).
- **ErrorBoundary**: wraps `BusinessDiagram` and `QuarterlyResults` in Report.tsx — renders a dark navy fallback card instead of crashing.
- **Cloudflare Workers deploy**: `wrangler.jsonc` configures SPA routing (`not_found_handling: single-page-application`) and Node.js compatibility flags. Deploy with `npm run deploy` from `frontend/`.
- **Railway deploy**: Backend runs as a Docker container (multi-stage `node:22-alpine` build). `railway.toml` specifies the Dockerfile path, healthcheck at `/api/v1/health`, restart policy `on_failure`. Server **must** bind to `0.0.0.0` (not `127.0.0.1`) and use `process.env.PORT` — Railway assigns the port dynamically.
- **Tailwind v4**: Migrated from v3 to v4. Config uses the new `@import "tailwindcss"` syntax in CSS. Custom theme tokens live in `tailwind.config.ts` but the CSS entry uses `@theme` blocks in `index.css`.

### Pipeline v2 (backtest improvements — IBRX/AMPX lessons)

The AI research pipeline was upgraded based on real backtest results from researching IBRX and AMPX.

| Change                       | Why                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platform classification**  | Step 1 now outputs `platform_type` ("platform" or "single-product") and `platform_optionality` (adjacent markets with TAM estimates)                                                 |
| **Re-rating catalyst**       | Step 1 outputs `rerating_catalyst` — the single event that could force a 2–3x reprice within 24 months                                                                               |
| **3-scenario napkin math**   | Step 3 produces Bear/Base/Bull scenarios with `comp_ticker`, `comp_multiple`, `target_price`, `upside_percent`, `rationale`. Primary `napkin_math` always uses the **Base** scenario |
| **Comp selection rules**     | If subject company grows >50% YoY, at least 2 comps must be growing >30% YoY — prevents a mature-peer anchor dragging down a hypergrowth valuation                                   |
| **Bear case rebuttal**       | Step 4 adds `bear_case_rebuttal` — bull-perspective counter-argument to the bear case                                                                                                |
| **Temp overhang protection** | Temporary overhangs (recent regulatory letters, pending litigation) must NOT reduce score below 4.5 for >50% YoY growth + genuine moat                                               |
| **Platform premium**         | +0.5 to final score if `platform_type == "platform"` and `platform_optionality` lists 2+ adjacent markets                                                                            |
| **Napkin math rule**         | `napkin_math.target_price` must mirror the Base scenario. Bear scenario belongs in `scenarios[]` only — never use it as the headline number                                          |

---

## Known Pitfalls (Lessons Learned)

- **`thesis` field can be an array** in older reports (Claude sometimes returns `["word", "word"]`). Always coerce: `Array.isArray(v) ? v.join(' ') : String(v)` before rendering.
- **Percentage fields** (`gross_margin`, `yoy_growth`) may be stored as decimals (0.39) or already-multiplied percentages (39). Use `normPct()` guard: if `|value * 100| > 200`, use value directly.
- **Flex container width collapse**: in the report hero, the right column (score + sector tags) must have `max-w-xs sm:max-w-sm` to prevent sector tag overflow from stealing all flex space from the thesis column.
- **`report_json` optional fields**: always use `?? []` / `?? ''` defaults — old reports predate `quarterly_results`, `risk_factors`, etc.
- **`Write` tool requires prior `Read`**: the Write tool will error if the file hasn't been read first in the conversation.
- **No `style={{}}` props** except for SVG/canvas attributes — all styling via Tailwind only (per CLAUDE.md rule).
- **Step 4 search explosion**: Risk Red Team prompt must be capped to 4 searches max and `< 800 words` — otherwise the model chains many searches and takes 600+ seconds.
- **`scenarios` array (v2)**: `report_json.scenarios` may be absent in pre-v2 reports. Always default to `[]`. When rendering, never assume exactly 3 entries — guard with `?.find(s => s.label === 'Base')`.
- **`platform_optionality` and `rerating_catalyst`**: absent in pre-v2 reports. Default to `''`.
- **Railway PORT binding**: Express must call `app.listen(PORT, '0.0.0.0', ...)` — binding to `127.0.0.1` silently breaks Railway health checks and routing.
- **Tailwind v4 config**: `tailwind.config.ts` still defines the design tokens, but the CSS entry (`index.css`) uses `@import "tailwindcss"` and `@theme {}` blocks — not the v3 `@tailwind base/components/utilities` directives.

---

## Test Strategy

- Unit test every parser (`parseNumberedList`, `parseBullets`, `normPct`, `extractGuideNumbers`)
- Test every Zod schema for valid and invalid inputs
- Test role-based rendering in frontend components
- Mock Supabase and Anthropic SDK in all tests — never call live APIs in tests
- Every custom hook tested with React Testing Library
