# CLAUDE.md — moat-finder

---

## Project Purpose

A web application that takes an input of a stock ticker and generates a detailed AI-powered research
report about the company — focused on finding asymmetric risk/reward opportunities.

---

## Architecture

| Layer | Tools | Notes |
| --- | --- | --- |
| Frontend | React 18 + Vite + Tailwind CSS v3 | Dark navy / cream / gold design system |
| Frontend hosting | Vercel | |
| Backend | Node.js v20 + Express 4 + TypeScript strict | |
| Backend hosting | Render | |
| Security layer | CloudFlare | DDoS, rate limiting, SSL, CF-Connecting-IP |
| Auth | Supabase Auth (Google OAuth) | Role-based: admin / approved / pending / rejected |
| Database | Supabase (Postgres) with RLS | |
| Diagram | Pure React / Tailwind (React Flow removed) | 4-zone stacked canvas |
| AI | Claude claude-sonnet-4-6 + web_search tool | 7-step pipeline |

---

## Hard Constraints

1. **Minimize external dependencies** — standard libraries only where possible.
2. **Modular approach** — frontend, backend, AI pipeline are separate concerns.
3. **Security is always number one priority** — hardened, no secrets in frontend.
4. **CloudFlare sits in front of everything** — CF-Connecting-IP for real IP logging.
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
├── docs/
│   ├── ARCHITECTURE.md          # System design
│   ├── DATABASE.md              # Schema source of truth
│   └── FEATURES.md              # Product requirements
├── backend/
│   ├── CLAUDE.md                # Backend-specific rules
│   └── src/
│       ├── routes/
│       │   ├── research.ts      # GET/POST/PUT research endpoints
│       │   └── admin.ts         # Admin user management
│       ├── services/
│       │   ├── pipeline.ts      # 7-step AI research pipeline
│       │   ├── diff.ts          # Report diff/changelog generator
│       │   └── supabase.ts      # anon + service-role clients
│       └── types/
│           └── report.types.ts  # Shared pipeline + report types
├── frontend/
│   ├── CLAUDE.md                # Frontend-specific rules
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

| Hook | Trigger | Purpose |
| --- | --- | --- |
| `block-dangerous.sh` | PreToolUse/Bash | Blocks `rm -rf`, force-push, and other destructive commands |
| `log-commands.sh` | PreToolUse/Bash | Logs every shell command Claude runs (audit trail) |
| `protect-files.sh` | PreToolUse/Edit,Write | Prevents edits to `.env`, `database.types.ts`, and other protected files |
| `require-tests-for-pr.sh` | PreToolUse/mcp__github__create_pull_request | Blocks PR creation if no test files exist for changed source |
| `track-doc-changes.sh` | PostToolUse/Edit,Write | Appends edited `.ts`/`.tsx` file paths to `.claude/pending-doc-updates.txt` |
| `remind-doc-update.sh` | Stop | If `pending-doc-updates.txt` has entries, prints a reminder box listing changed files, then clears it |
| `auto-commit.sh` | Stop | Auto-commits staged changes if configured |
| Prettier + ESLint | PostToolUse/Edit,Write | Auto-formats and auto-fixes each edited file immediately after write |

**Important**: `track-doc-changes.sh` only tracks `.ts`/`.tsx` files. It will NOT fire when `.sh`, `.md`, `.json`, or other config files change. If those files change in a way that affects architecture, pitfalls, or rules, update the relevant CLAUDE.md files manually.

---

## Language & Runtime

- TypeScript strict mode throughout — no `any` types, ever
- Node.js v20 LTS (backend)
- Package manager: npm

## Commands

```bash
# Backend (from backend/)
npm run dev        # tsx watch — port 3001
npm run build      # tsc compile
npm run typecheck  # tsc --noEmit
npm run test       # vitest run

# Frontend (from frontend/)
npm run dev        # Vite dev server — port 5173
npm run build      # Vite production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
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

---

## Known Pitfalls (Lessons Learned)

- **`thesis` field can be an array** in older reports (Claude sometimes returns `["word", "word"]`). Always coerce: `Array.isArray(v) ? v.join(' ') : String(v)` before rendering.
- **Percentage fields** (`gross_margin`, `yoy_growth`) may be stored as decimals (0.39) or already-multiplied percentages (39). Use `normPct()` guard: if `|value * 100| > 200`, use value directly.
- **Flex container width collapse**: in the report hero, the right column (score + sector tags) must have `max-w-xs sm:max-w-sm` to prevent sector tag overflow from stealing all flex space from the thesis column.
- **`report_json` optional fields**: always use `?? []` / `?? ''` defaults — old reports predate `quarterly_results`, `risk_factors`, etc.
- **`Write` tool requires prior `Read`**: the Write tool will error if the file hasn't been read first in the conversation.
- **No `style={{}}` props** except for SVG/canvas attributes — all styling via Tailwind only (per CLAUDE.md rule).
- **Step 4 search explosion**: Risk Red Team prompt must be capped to 4 searches max and `< 800 words` — otherwise the model chains many searches and takes 600+ seconds.

---

## Test Strategy

- Unit test every parser (`parseNumberedList`, `parseBullets`, `normPct`, `extractGuideNumbers`)
- Test every Zod schema for valid and invalid inputs
- Test role-based rendering in frontend components
- Mock Supabase and Anthropic SDK in all tests — never call live APIs in tests
- Every custom hook tested with React Testing Library
