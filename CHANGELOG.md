# Changelog

All notable changes to moat-finder are listed here in reverse chronological order.

---

### v0.8.2

- **YoY growth filter**: filter bar on home page now includes
  "YoY ≥ %" input. Filters stocks by YoY revenue growth from
  `valuation_table[0].yoy_growth`.
- **YoY growth on cards**: stock cards show YoY growth rate
  (emerald ≥50%, amber 0–49%, red negative) below upside %.
- **Mobile report layout**: report page now fully responsive on
  iPhone 16 Plus — no horizontal scroll. Two-column layout
  stacks to single column on mobile. Valuation table gets
  horizontal scroll wrapper. Business model diagram contained.

---

### v0.8.1

- **Two-phase discovery flow (stateless)**: replaced fragile shared-Map `/confirm` endpoint with clean `/discover` + `/run` pattern. Step 1 runs first via SSE, emits `confirm_required` with company name and `run_id`. User confirms, frontend opens a second SSE stream to `/run` with the saved `run_id` — no server-side state sharing, Railway-safe.
- **Immediate confirmation feedback**: clicking "Yes, this is correct" now shows spinners on all pending steps within <100ms instead of 40–50 second blank screen. Fire-and-forget confirm, SSE `started` events update step state instantly.

### v0.8.0

- **International stock support**: ticker validation now accepts exchange suffixes (e.g. `EOS.AX`, `7203.T`, `005930.KS`). 15+ exchanges mapped: ASX, TSE (Tokyo), KRX, KOSDAQ, HKEX, SGX, NZX, LSE, XETRA, Euronext, SIX, TSX, B3, and more.
- **Exchange-aware prompts**: all 7 pipeline steps receive exchange, country, and currency context. Step 3 (Valuation) reports in local currency (AUD, JPY, KRW, etc.).
- **Ambiguous ticker protection**: Step 1 explicitly searches for the ticker on its primary exchange to prevent wrong-company resolution (e.g. `TE` → TE Connectivity vs T1 Energy).
- **Company name confirmation UI**: after Discovery completes, a confirmation card shows the resolved company name before running the full 6-step pipeline. "Wrong company" flow allows correction.
- **Exchange badge** on report header for non-US tickers.
- **Input updated**: placeholder `"Ticker (e.g. NVDA, EOS.AX, 7203.T)"`, maxLength 14.

### v0.7.0 — Design System

- **Stripe DESIGN.md**: full frontend reskin using Stripe's premium fintech aesthetic — dark purple-gradient hero, clean borders, weight-300 body typography.
- **Plus Jakarta Sans**: replaces Playfair Display + Inter. Geometric, elegant at weight 300. JetBrains Mono kept for all financial numbers.
- **Key Risks readability**: white title text + slate-300 description on dark surface; red used for border accents and icon only — no more red text on red background.
- **Napkin math layout**: Target Price and Upside stacked vertically to prevent overflow on large numbers.
- **Business Model diagram KEY RISKS zone**: same white-on-dark fix applied to the inline risk zone inside the business diagram.

### v0.6.6

- **Unwrap JSON envelope**: `extractJSON` now detects single-key wrapper objects (`{"report": {...}}`) and unwraps automatically. Claude sometimes wraps synthesis output in a named key — this silently corrects it.
- **Flat synthesis instruction**: Step 7 prompt explicitly forbids wrapper keys and requires the first property to be `thesis` or `score`.

### v0.6.5

- **Bulletproof JSON extraction**: `extractJSON` rewritten to use depth-tracking brace matching and a regex that finds real JSON objects (`{` followed by `"` or `}`) rather than template placeholders like `{TICKER}`.
- **callClaude uses last text block**: when Claude emits multiple text blocks (pre/post web_search), the last non-empty block is used as the response — prevents `{MU}` prose polluting JSON parse.
- **Per-step retry on JSON failure**: any step that fails with a JSON parse error retries once with an explicit format instruction prepended to the prompt.
- **Cross-provider checkpoint clearing**: on Update Research, if the provider is switching (e.g. Gemini→Claude), ALL checkpoints are cleared for a fully consistent re-run. Same provider but missing/wrong-schema `management_rating` clears only Steps 2+3.
- **New research stale-checkpoint detection**: Step 2 checkpoint missing `management_rating` or using Schema B is deleted and re-run on resume.
- **DELETE endpoint**: `DELETE /api/v1/research/:ticker` (admin only) removes report, versions, and checkpoints in one call.

### v0.6.4

- **Moat & Competitors**: numbered points `(1) … (2) …` are now parsed into clean numbered cards matching the Catalysts section style — no more bolded partial sentences as fake headings.
- **Version history target price**: diff card now shows `Target: $282 → $312 (+10.7%)` when napkin math target price changes between versions.

### v0.6.3

- **ManagementRating null safety**: component handles both Schema A (correct, with `categories`) and Schema B (Gemini alternative with `ceo_assessment`). Renders simplified view for Schema B. All field accesses null-guarded.
- **Strict management_rating schema enforcement**: Step 2 prompt now includes the exact required JSON structure with field names and character limits — prevents Gemini from inventing alternative schemas.
- **Management_rating excluded from synthesis context**: Step 7 no longer receives management_rating in its context (too large, caused JSON truncation). Rating is merged back post-synthesis.

### v0.6.2

- **Gemini universal search enforcement**: system instruction strengthened with mandatory `NEVER refuse` rule; all steps prepend a `geminiSearchPrefix` that forces `googleSearch` usage before responding.
- **503 retry**: Gemini `callGemini()` retries after 3-second wait on 503 Service Unavailable.
- **Gemini model**: updated to `gemini-2.5-flash` (env: `GEMINI_MODEL`). Flash-Lite deprecated for financial research due to unreliable grounding on complex financial steps.
- **Null safety on home page**: filter/sort comparators use optional chaining on all string fields to prevent `toUpperCase` crashes.

### v0.6.1

- **Management rating independent**: score (1–10) no longer influenced by management grade. Management rating is a standalone A–F scorecard shown in the sidebar with subtitle "Independent assessment — not included in investment score."
- **Management rating backfill on update**: Update Research detects reports missing `management_rating` or using Gemini's alternative schema and forces a fresh Step 2 re-run automatically.

### v0.6.0

- **Management rating backfill**: update pipeline detects reports missing `management_rating` and forces a fresh Step 2 re-run to generate one. New research pipeline also invalidates any stale Step 2 checkpoint missing the field.
- **Enriched list API**: `GET /api/v1/research` now returns `upside_percent`, `target_price`, `hot_sector_match`, `sector_heat`, `thesis`, `company_name`, and `sector` — no extra API calls needed on the frontend.
- **Napkin math on home cards**: target price (gold) and upside (green/red) shown on every stock card. First hot-sector match tag shown as a muted pill.
- **Filter & sort bar**: above the researched-tickers grid — filter by Score ≥, Upside ≥, Sector (substring), and sort by date/score/upside. Client-side only, instant. "Showing X of Y stocks" count.

### v0.5.2

- **Management Rating**: independent A–F management quality assessment generated in Step 2 (Deep Dive). Covers CEO track record, recent leadership changes, and capital allocation. Injected into the report after Step 7 synthesis — the scoring LLM never sees it, so it cannot influence the 1–10 investment score. New `ManagementRating.tsx` sidebar card with subtitle "Independent assessment — not included in investment score". Field `report_json.management_rating` is optional; absent in pre-v0.5.2 reports.

### v0.5.1

- **BusinessDiagram RiskZone readability**: KEY RISKS zone had red text on a red-tinted background. Fixed to `border-l-4 border-red-500` left accent with dark navy surface, `text-white` titles, `text-slate-300` body text.

### v0.5.0

- **Stripe design system**: full frontend restyle. Navy palette remapped to purple-tinted indigo. Purple (`#533afd`) replaces green/gold for all UI chrome. Gold (`#d4a853`) reserved for financial data. Stripe blue-tinted shadow on hero sections. Hero sections use `bg-gradient-to-br from-navy-800 via-[#1f2170] to-navy-950`.
- **Font replacement**: proprietary Söhne replaced with Plus Jakarta Sans (Google Fonts). Playfair Display and Inter removed. Global `font-weight: 300` default with heading overrides. JetBrains Mono kept for financial data.
- **BearCase readability**: Key Risks section fixed from red-on-red to left-border-only accent with readable dark surface.
- **NapkinMath layout**: Target Price and Upside now stack vertically (`flex-col gap-2`) instead of side-by-side, eliminating overflow at all viewport widths.

### v0.3.0

- **Multi-LLM support**: new `llm.ts` abstraction layer routes research to Claude (`claude-sonnet-4-6` + `web_search` tool) or Gemini (`gemini-2.5-flash-lite` + `googleSearch` grounding), selectable per run
- **LLM selector**: provider dropdown (Claude / Gemini) in the research confirm modal; defaults to Claude
- **LLM badge**: small `✦ Claude` or `◆ Gemini` badge shown in the report header
- **Provider persistence**: `report_json.llm_provider` and `report_json.llm_model` recorded for every report; update research automatically re-uses the same provider
- **New env vars**: `GEMINI_API_KEY` (optional, Railway) and `DEFAULT_LLM=claude` (optional)

### v0.2.2

- **Trust proxy**: `app.set('trust proxy', 1)` added as the first line after `express()` — fixes `express-rate-limit` `ValidationError` behind Cloudflare + Railway proxy layers that was crashing SSE connections before reports could save
- **Step 7 JSON hardening**: strengthened system prompt to forbid prose responses; added `extractJSON()` with fence-stripping and outermost `{…}` search; try/catch deletes only the Step 7 checkpoint on parse failure so Steps 1–6 survive for the next retry
- **Score field**: Step 7 now explicitly outputs `score` (1.0–10.0) in the JSON schema; `report.score` correctly used instead of `sector_heat` for the Supabase `score` column
- **Save reliability**: `tickerData` null guard tightened; explicit `console.error` on every Supabase write failure; verification read-back after PUT version insert; `(existingReport.version ?? 1) + 1` guards missing version field

### v0.2.1

- **Constraint & value chain analysis**: Step 2 (Deep Dive) now performs a full 8-point bottleneck analysis — classifies the primary constraint (supply chain / technology / regulatory / capital / none), tests whether the company OWNS the constraint (not just adjacent to it), assesses durability, value chain position, rent capture, investability, who can relieve it, and the investable window before consensus prices it in
- **Scoring update**: Step 7 applies a +0.5 constraint premium when `investable=true`, `controls_constraint=true`, and `durability=durable`; applies a constraint penalty if the company is adjacent to a bottleneck but does not capture the rent
- **Bug fix — update pipeline token waste**: `runUpdatePipeline` was incorrectly running Steps 2 and 4 via an empty cache map, causing unnecessary Claude API calls and false `error` SSE events that made the frontend show a failure state. Fixed by calling only Steps 3, 5, 6 directly

### v0.2.0

- **Hosting migration**: Vercel → Cloudflare Workers (frontend), Render → Railway (backend)
- **Backend containerised**: Docker multi-stage build on `node:22-alpine`
- **Frontend updated**: React 18 → 19, Tailwind v3 → v4, React Router v6 → v7, Vite v8
- **Pipeline v2**: platform classification, 3-scenario napkin math, bear case rebuttal, comp selection rules, platform premium scoring, temp-overhang scoring protection
- **CI/CD**: GitHub Actions workflow for automated deploys
- **Security**: Content Security Policy hardening for Cloudflare Workers headers
- **Tailwind v4**: migrated to `@import "tailwindcss"` + `@theme {}` syntax

### v0.1.0

- Initial release: React + Express + Supabase + Anthropic 7-step pipeline
- Vercel (frontend) + Render (backend) hosting
- Role-based auth, diff-tracked versioning, SSE streaming progress
