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
│       │   │                    # BusinessDiagram, QuarterlyResults,
│       │   │                    # ManagementRating
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
- **Font stack**: Plus Jakarta Sans (headings + body / `font-display` + `font-body`), JetBrains Mono (data / `font-mono`). Global `font-weight: 300` with heading overrides (h1–h3 → 700, h4–h6 → 600).
- **ErrorBoundary**: wraps `BusinessDiagram` and `QuarterlyResults` in Report.tsx — renders a dark navy fallback card instead of crashing.
- **Design system**: Stripe dark adaptation — navy tokens remapped to purple-tinted indigo (`navy-800: #1c1e54`, `navy-900: #0d1b38`). Purple (`#533afd`) for all UI chrome. Gold (`#d4a853`) preserved for financial data only. Score colors (emerald/amber/red) preserved exactly.
- **ManagementRating**: generated in Step 2 (Deep Dive) as an independent LLM assessment. Injected into `parsed.report` after Step 7 synthesis completes — the scoring LLM never sees it and it does NOT influence the 1–10 investment score. Field: `report_json.management_rating` (optional, absent in pre-v0.5.2 reports).
- **Management rating backfill**: `runUpdatePipeline` checks for a missing `management_rating` on the existing report before deciding whether to reuse cached Step 2 data. If missing, Step 2 re-runs fresh. If present, `management_rating` is carried into the reconstructed `Step2Output`. Similarly, `runPipeline` deletes any cached Step 2 checkpoint that lacks `management_rating` so old checkpoints don't bypass the re-run.
- **Enriched list API**: `GET /api/v1/research` returns `ResearchListItem` objects (flat — no nested `tickers`) including `upside_percent`, `target_price`, `hot_sector_match`, `llm_provider`, `sector_heat`, `thesis`, `company_name`, `sector`.
- **Home page filter bar**: client-side filter and sort over the enriched list — Score ≥, Upside ≥, Sector substring, and sort by date/score/upside. Stock cards now show target price and upside from `napkin_math`, plus a hot-sector pill.
- **Cloudflare Workers deploy**: `wrangler.jsonc` configures SPA routing (`not_found_handling: single-page-application`) and Node.js compatibility flags. Deploy with `npm run deploy` from `frontend/`.
- **Railway deploy**: Backend runs as a Docker container (multi-stage `node:22-alpine` build). `railway.toml` specifies the Dockerfile path, healthcheck at `/api/v1/health`, restart policy `on_failure`. Server **must** bind to `0.0.0.0` (not `127.0.0.1`) and use `process.env.PORT` — Railway assigns the port dynamically.
- **Tailwind v4**: Migrated from v3 to v4. Config uses the new `@import "tailwindcss"` syntax in CSS. Custom theme tokens live in `tailwind.config.ts` but the CSS entry uses `@theme` blocks in `index.css`.

### Pipeline v2 + Management Rating (v0.5.2)

- **management_rating** is generated in Step 2 (Deep Dive) as a structured independent assessment: grade (A–F), score (0–100), summary, CEO assessment, recent changes, capital allocation.
- In `runStep7()`, after the LLM synthesis JSON is parsed, `step2.management_rating` is injected directly into `parsed.report`. The Step 7 scoring prompt never receives it — the 1–10 investment score is based solely on moat quality, valuation vs peers, revenue growth, sector heat, and asymmetric setup.
- `ManagementRating.tsx` sidebar card displays the rating with grade color coding and a subtitle: "Independent assessment — not included in investment score".
- `report_json.management_rating` is optional — old reports without it render nothing (no fallback needed).

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
- **Gemini googleSearch grounding**: requires `GEMINI_API_KEY` in Railway env. Without it, any Gemini research request returns a 400 before the SSE stream opens.
- **Gemini may return markdown-wrapped JSON**: `extractJSON()` in `backend/src/services/llm.ts` strips fences and finds the outermost `{…}` — do not remove this guard.
- **Provider is stored per-report**: `report_json.llm_provider` records which LLM generated the report. Update research re-uses the same provider automatically (read from the existing report in `Report.tsx → handleUpdate`).
- **LLM abstraction layer**: all pipeline steps call `callLLM(prompt, provider)` in `backend/src/services/llm.ts`. Add new providers there; pipeline.ts stays provider-agnostic.
- **management_rating in old reports**: absent in reports generated before v0.5.2. Always guard with optional chaining (`rj.management_rating && <ManagementRating ...>`). Do NOT add a fallback render — just don't show it. The update pipeline will regenerate it on next update.
- **`ResearchListItem` vs `ResearchReport`**: the list API (`GET /api/v1/research`) returns `ResearchListItem[]` (flat, enriched). Individual report fetches (`GET /api/v1/research/:ticker`) still return `ResearchReport` (full). Do not use `ResearchReport` in the home page cards — it does not have `upside_percent`, `target_price`, etc.
- **`hot_sector_match` null entries**: the LLM may return null inside the `hot_sector_match` array even though the type says `string[]`. Always use `s?.toLowerCase()` (not `s.toLowerCase()`) when iterating, and `(report.hot_sector_match ?? [])` before `.length` or index access.
- **Claude `max_tokens`**: synthesis (Step 7) produces large JSON. `max_tokens` in `llm.ts` is set to `16000` — do not lower it or synthesis will truncate mid-JSON for complex reports.
- **Stripe color token remapping**: navy scale was remapped in-place (same token names, new values). `navy-800` is now `#1c1e54` (Stripe brand dark), `navy-900` is `#0d1b38`. Components did not need class name changes — only the token values changed.
- **Gold vs purple rule**: gold (`#d4a853`) is for financial data only (ticker symbols, target price, valuation labels, timing data). Purple (`#533afd`) is for all UI chrome (buttons, focus rings, borders, accents, spinners). Never use gold for navigation, buttons, or interactive elements.

---

## Test Strategy

- Unit test every parser (`parseNumberedList`, `parseBullets`, `normPct`, `extractGuideNumbers`)
- Test every Zod schema for valid and invalid inputs
- Test role-based rendering in frontend components
- Mock Supabase and Anthropic SDK in all tests — never call live APIs in tests
- Every custom hook tested with React Testing Library

---

## Changelog

### v0.6.6

- **Single-key envelope unwrapping** (`llm.ts`): Added `STEP_FIELDS` set (all known field names from every pipeline step) and `unwrapEnvelope()` function. `extractJSON` now calls `unwrapEnvelope` on both the direct parse result and the repaired parse result. If Claude returns `{"report": {"thesis":"..."}}` instead of the expected flat object, the single-key wrapper is silently stripped and the inner object returned. Only unwraps when the inner object contains at least one known step field — prevents false positives on legitimate single-key responses.
- **Flat synthesis prompt** (`pipeline.ts` Step 7): Added CRITICAL FORMATTING RULE block at the very start of the synthesis prompt with a WRONG/CORRECT example showing the envelope antipattern. Changed "exactly two keys: report and diagram" to flat format instruction. Schema section changed from `"report" must match...` + `"diagram" must match...` two-block structure to a single flat schema with `diagram` as a sibling field at top level. Closing line changed from "Return only the JSON object with 'report' and 'diagram' keys" to the flat format reminder.
- **Flat synthesis parsing** (`pipeline.ts` Step 7): Changed `let parsed: { report: ReportJson; diagram: DiagramJson }` to `let report: ReportJson; let diagram: DiagramJson`. `extractJSON` result cast to `Record<string, unknown>`; `reportSource` determined by checking if `flat.thesis` or `flat.score` exists (new flat format) vs falling back to `flat.report` as an object (legacy two-key format). `diagram` extracted from `flat.diagram ?? reportSource.diagram`, defaulting to `{nodes:[], edges:[]}`. All `parsed.report.X` references changed to `report.X`; `parsed.diagram` to `diagram`. Backward-compatible: handles legacy `{"report":{...},"diagram":{...}}` responses automatically.

### v0.6.5

- **Bulletproof `extractJSON`** (`llm.ts`): Replaced with depth-tracking implementation that handles BOM, `{variable}` prose before JSON, multiple text blocks concatenated, and trailing prose after JSON. Valid-object regex `/\{[\t\n\r ]*["}\[]/g` skips `{TICKER}` patterns. Closing brace found by bracket-depth tracking; falls back to `lastIndexOf` only on truncated responses. Accepts optional `provider` arg for richer error context.
- **Claude last-text-block** (`llm.ts`): `runClaude` now collects ALL non-trivial text blocks and returns the LAST one. Claude emits prose before web_search tool calls, then the real JSON after — joining all blocks contaminated the JSON with pre-search prose. Both `end_turn` and `max_tokens` fallback paths updated.
- **Per-step JSON retry** (`pipeline.ts`): `runStepWithFallback` now detects JSON errors (`No JSON object found`, `JSON parse failed`, `Malformed JSON`, `empty response`, `Unexpected token`, `position 1`) and retries the step runner once before falling back to defaults. Emits `started` event with retry message. Accepts `provider` param for logging. All callers in `runParallelSteps` and `runUpdatePipeline` updated.
- **Provider-switch checkpoint clearing** (`routes/research.ts` PUT handler): Before calling `runUpdatePipeline`, the route now checks if the provider changed. Provider switch → delete ALL checkpoint rows for that ticker. Same provider + bad management_rating schema → delete steps 2+3 only. Wrapped in try/catch so cleanup failure never blocks the pipeline.
- **Expanded stale Step 2 cache check** (`pipeline.ts` `runPipeline`): The cached-Step-2 invalidation now checks for Schema B as well as missing management_rating — specifically: `!categories`, `ceo_assessment !== undefined`, `total_score === undefined`. Previously only caught the "completely missing" case.
- **`NapkinMath.tsx` null guards**: All field accesses use optional chaining and `?? 0` / `?? ""` fallbacks — `upside_percent`, `target_price`, `revenue_guidance`, `comp_ticker`, `comp_multiple`. Prevents crashes when LLM returns null for typed-as-number fields.
- **`ValuationTable.tsx` null guards**: `ticker.toUpperCase()` in sort comparator and `isSubject` check both guarded with `(ticker ?? "").toUpperCase()` — prevents crash if LLM returns null for ticker field.
- **`Home.tsx` date sort null guard**: `new Date(b.updated_at ?? 0).getTime()` — defensive guard on `updated_at` in the date sort comparator.
- **`extractJSON` provider arg propagated**: All callers in `pipeline.ts` (`runStep1`, `parseWithGeminiRetry` ×2, `runStep7`) now pass `provider` to `extractJSON` for richer error logs.

### v0.6.3

- **DELETE /api/v1/research/:ticker** (`backend/src/routes/research.ts`): Admin-only endpoint that hard-deletes a ticker and all associated data. Deletes in dependency order: `research_checkpoints` → `research_versions` → `research_reports`. Uses `authenticate` + `requireRole("admin")` middleware. Returns `{ success: true, message }` on success or `{ error, details }` on failure.

### v0.6.2

- **Dual-schema ManagementRating support** (`ManagementRating.tsx`, both `report.types.ts`): Component now handles Schema A (canonical: `total_score`, `categories` with 5 scored sub-dimensions, `key_person`, `red_flags`, `green_flags`) and Schema B (Gemini legacy: `score`, `ceo_assessment`, `recent_changes`, `capital_allocation`). Schema detected via `!!rating?.categories`. Schema A renders 5 progress bars; Schema B renders simplified text view. Null/undefined `data` prop shows "not available" message. All field accesses guarded with optional chaining.
- **`ManagementRating` type updated** (both type files): Added `ManagementRatingCategory` interface. `ManagementRating` now has optional fields for both schemas — `total_score`, `categories`, `key_person`, `red_flags`, `green_flags` (Schema A) plus `score`, `ceo_assessment`, `recent_changes`, `capital_allocation` (Schema B). Only `grade` remains required.
- **Step 2 prompt enforces Schema A** (`pipeline.ts`): `management_rating` JSON structure in the Step 2 prompt replaced with Schema A. Fields description updated. CRITICAL enforcement note added explicitly forbidding `ceo_assessment`, `recent_changes`, `capital_allocation` field names.
- **Synthesis prompt excludes management_rating** (`pipeline.ts` Step 7): Added "MANAGEMENT RATING NOTE" to synthesis prompt instructing the LLM not to include `management_rating` in synthesis output. Synthesis already merges it post-generation; this prevents double-inclusion or corruption from embedded long strings.
- **pipeline_steps_raw strips management_rating details** (`pipeline.ts` Step 7): `step2ForRaw` stored in `pipeline_steps_raw.step2` contains only `{total_score, grade}` for the management_rating — not the full text fields. Keeps stored JSON smaller.
- **Schema B detection in update pipeline** (`pipeline.ts` `runUpdatePipeline`): `needsManagementRating` now also triggers when existing report has Schema B (`ceo_assessment` present, `categories` absent) — forces Step 2 re-run to regenerate with Schema A. Covers LEU and other reports generated by Gemini before the schema fix.

### v0.6.1

- **Null safety in sort/filter** (`Home.tsx`): sector filter comparator now uses `r.hot_sector_match?.some(s => s?.toLowerCase()?.includes(...))` — prevents crash when any `hot_sector_match` entry is null. Card rendering uses `(report.hot_sector_match ?? [])` guards before `.length` and index access.
- **ManagementRating null safety** (`ManagementRating.tsx`): `gradeClasses()` parameter widened to `string | null | undefined`; grade display changed to `data.grade?.toUpperCase() ?? 'N/A'` — prevents crash if LLM returns null for grade.
- **Increase Claude `max_tokens`** (`llm.ts`): raised from `8192` to `16000` — prevents synthesis JSON truncation at ~13710 chars for large reports (LEU and similar).
- **Synthesis conciseness instruction** (`pipeline.ts` Step 7 prompt): added instruction to keep all string fields under 200 characters and arrays to max 5 items, so synthesis JSON fits within token limits while remaining complete and valid.

### v0.6.0

- **Management rating backfill** (`runUpdatePipeline`): checks `existingReport.management_rating` before deciding whether to use cached Step 2. If missing, deletes stale Step 2 checkpoint and re-runs Step 2 fresh (concurrently with Steps 3/5/6) to generate a new `management_rating`. If present, carries it into the reconstructed `Step2Output` so Step 7's post-synthesis injection still works.
- **Checkpoint resume guard** (`runPipeline`): if a cached Step 2 checkpoint is loaded but missing `management_rating` (from an old run), it is deleted from both the in-memory map and the DB checkpoint, forcing a fresh re-run.
- **Enriched list API** (`GET /api/v1/research`): now selects `report_json` alongside existing columns and maps each row to include `upside_percent`, `target_price`, `hot_sector_match`, `llm_provider`, `sector_heat`, `thesis` (truncated to 150 chars), plus `company_name` and `sector` from the `tickers` join. Returns flat objects (no nested `tickers`).
- **`ResearchListItem` type**: new frontend interface (`frontend/src/types/report.types.ts`) for the enriched list API response. `useReportList()` now returns `ResearchListItem[]`.
- **Napkin math on home cards**: each stock card now shows target price (gold, JetBrains Mono) and upside percent (emerald if ≥0, red if <0, always shows sign). First `hot_sector_match` tag displayed as a muted pill alongside the existing sector pill.
- **Filter & sort bar**: compact filter bar above the stock grid with Score ≥, Upside ≥, Sector (substring match on `hot_sector_match`), and Sort (Newest / Score ↓ / Upside ↓). All filtering is client-side — no new API calls. "Showing X of Y stocks" count shown below the bar. "Clear Filters" button appears only when any filter is active.

### v0.5.2

- **Management Rating**: new independent management assessment field generated in Step 2 (Deep Dive). Grade A–F, score 0–100, CEO assessment, recent changes, capital allocation. Injected into report post-synthesis so Step 7 scoring LLM never sees it. New `ManagementRating.tsx` sidebar card with subtitle "Independent assessment — not included in investment score". Field: `report_json.management_rating` (optional, absent in pre-v0.5.2 reports).

### v0.5.1

- **BusinessDiagram RiskZone readability**: KEY RISKS zone inside the Business Model diagram had red text on red-tinted background. Fixed: `border-l-4 border-red-500 bg-navy-900` container, risk card title → `text-white font-semibold`, detail → `text-slate-300 font-light`, icon stays `text-red-400`.

### v0.5.0

- **NapkinMath vertical stack**: Target Price and Upside stacked vertically (`flex flex-col gap-2`) instead of side-by-side, preventing overflow at any viewport width. Both use `text-3xl font-bold`.
- **BearCase readability**: Key Risks zone fixed from red text on dark red background to `border-l-4 border-red-500` left accent only, dark navy background, `text-white font-semibold` title, `text-slate-300 font-light` body.
- **BearCase title parsing**: Risk strings formatted as `"Title: Description"` now split into bold title + body text via `parseRiskTitle()`.

### v0.4.0 (Stripe design system)

- **Stripe dark design system**: Color palette migrated to Stripe-inspired dark adaptation. Navy tokens remapped to purple-tinted indigo. Purple (`#533afd`) replaces green/gold for all UI chrome. Gold (`#d4a853`) preserved exclusively for financial data. Score colors (emerald/amber/red) preserved.
- **Font replacement**: Söhne (proprietary) → Plus Jakarta Sans (Google Fonts). Playfair Display and Inter removed. Both `font-display` and `font-body` now resolve to Plus Jakarta Sans. JetBrains Mono kept. Global `font-weight: 300` with h1–h3 → 700 overrides.
- **Button**: 4px radius, purple primary (`bg-purple hover:bg-purple-dark`), ghost secondary with `border-navy-700`.
- **Nav**: white logo text (`text-cream font-display`), purple CTA buttons (replaced rounded-full border-cream style).
- **ScoreBadge / SectorHeat**: SVG hardcoded hex literals updated to match new navy palette.
- **PipelineProgress**: amber/gold spinner → purple; gold accents → purple.
- **Hero sections** (Home + Report): `bg-gradient-to-br from-navy-800 via-[#1f2170] to-navy-950` with Stripe blue-tinted shadow.
- **Report headings**: `font-light tracking-tight` with purple-light left border (was `font-semibold` with gold border).
- **Admin + Versions**: green accents → purple throughout.
