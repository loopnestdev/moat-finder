# CLAUDE.md — moat-finder/frontend

Read docs/ARCHITECTURE.md, docs/FEATURES.md, and docs/DATABASE.md before
making any changes to the frontend.

---

## Stack

- React 19 + Vite + TypeScript strict
- Tailwind CSS v4 — mobile-first, all layout via Tailwind utilities only
- React Router v7 — client-side routing
- TanStack Query (React Query) v5 — all server state, caching, loading states
- Supabase Auth JS v2 — session management, OAuth (Google)
- Zod — ticker input validation (shared schema with backend)

## Folder Structure

```text
frontend/
├── index.html                # Google Fonts + favicon link
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Router setup, auth provider
│   ├── pages/
│   │   ├── Home.tsx          # Ticker search + researched tickers grid
│   │   ├── Report.tsx        # Full research report page (two-column)
│   │   ├── Versions.tsx      # Version history page
│   │   ├── Admin.tsx         # Admin panel (users + audit log)
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Nav.tsx       # Responsive navbar — dark navy, white logo, purple CTA
│   │   │   └── Layout.tsx    # Page wrapper (bg-navy-900)
│   │   ├── report/
│   │   │   ├── ScoreBadge.tsx       # SVG circular gauge (sm/md/lg)
│   │   │   ├── SectorHeat.tsx       # SVG flame icons + sector chips
│   │   │   ├── ValuationTable.tsx   # 2-col card grid (subject highlighted)
│   │   │   ├── NapkinMath.tsx       # Target price + upside (stacked vertically)
│   │   │   ├── Scenarios.tsx        # Bear/Base/Bull scenario sidebar card
│   │   │   ├── BearCase.tsx         # Numbered dark card, red left border + Bull Rebuttal
│   │   │   ├── Changelog.tsx        # Dark navy version history accordion
│   │   │   ├── BusinessDiagram.tsx  # 4-zone pure-React canvas (no React Flow)
│   │   │   ├── QuarterlyResults.tsx # Last 4 quarters earnings card
│   │   │   └── ManagementRating.tsx # Independent management assessment sidebar card
│   │   ├── research/
│   │   │   ├── PipelineProgress.tsx # SSE step progress — dark navy themed
│   │   │   └── DiffModal.tsx        # Update confirmation modal
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Spinner.tsx
│   │   └── ErrorBoundary.tsx        # Class component, wraps risky sections
│   ├── hooks/
│   │   ├── useAuth.ts        # Supabase session + role
│   │   ├── useResearch.ts    # TanStack Query for report fetch
│   │   └── usePipeline.ts    # SSE connection management
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client (anon key only)
│   │   ├── api.ts            # fetch wrapper for backend API calls
│   │   ├── validation.ts     # Zod schemas (ticker, etc.)
│   │   ├── parsers.ts        # parseNumberedList, parseMoatPoints, parseBullets
│   │   ├── normPct.ts        # Shared decimal-or-percentage normaliser
│   │   └── napkinMath.ts     # buildCompOptions — Napkin Math comp selector logic
│   └── types/
│       └── report.types.ts   # Mirrors backend report types
├── public/
│   └── favicon.svg           # Moat-finder icon mark (navy + gold rings)
├── tailwind.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## Key Rules

1. **Mobile-first always** — write Tailwind classes mobile-first, use `sm:`, `md:`, `lg:` prefixes. Never design desktop-first.

2. **No inline styles** — all styling via Tailwind utility classes only. No `style={{}}` props except SVG/canvas attributes that cannot be expressed as Tailwind classes.

3. **TanStack Query for all data fetching** — no raw `useEffect` + `fetch` patterns.

4. **Auth state from `useAuth` hook only** — never read Supabase session directly in components.

5. **Anon key only in frontend** — `VITE_SUPABASE_ANON_KEY` only. Service role key must never appear in frontend code.

6. **SSE via `usePipeline` hook** — encapsulates EventSource lifecycle, cleanup on unmount. Never create EventSource directly in components.

7. **Accessible UI** — all interactive elements have ARIA labels. Minimum touch target 44×44px on mobile. Keyboard navigable.

8. **ErrorBoundary on risky sections** — wrap `BusinessDiagram` and `QuarterlyResults` in `<ErrorBoundary>` in Report.tsx. These parse complex `report_json` fields that may be absent in older reports.

9. **Array/string safety** — all `report_json` fields accessed in components must use `?? []` / `?? ''` defaults. Old reports predate `quarterly_results`, `risk_factors`, etc. Never call `.map()` or `.length` on a value that could be undefined.

## Design System

### Colours (tailwind.config.ts) — Stripe dark adaptation

```text
navy:   950=#06091a  900=#0d1b38  800=#1c1e54  750=#22256a  700=#2a2e7a  600=#362baa  400=#533afd  300=#b9b9f9
cream:  DEFAULT=#ffffff  muted=rgba(255,255,255,0.70)  subtle=rgba(255,255,255,0.45)
gold:   DEFAULT=#d4a853  light=#e8c07a  dark=#a87c35   ← financial data only
purple: DEFAULT=#533afd  dark=#4434d4  deep=#2e2b8c  light=#b9b9f9  mid=#665efd
ruby:   #ea2261   magenta: #f96bee
```

**Color rules:**

- **Purple** (`#533afd`) — all UI chrome: buttons, focus rings, borders, spinners, active tabs, section heading accents
- **Gold** (`#d4a853`) — financial data only: ticker symbols, target price, valuation multiples, duration badges
- **Score colors** — preserved exactly: `#10b981` (emerald, high), `#f59e0b` (amber, mid), `#ef4444` (red, low)
- **Red accent pattern** — risk zones use `border-l-4 border-red-500` accent only; `bg-navy-900` dark surface; `text-white font-semibold` title; `text-slate-300 font-light` body; `text-red-400` icon/label only

Score badge thresholds:

- 8.0–10.0: `text-emerald-400` / `animate-pulse-glow-emerald`
- 5.0–7.9: `text-amber-400` / `animate-pulse-glow-amber`
- 1.0–4.9: `text-red-400` / `animate-pulse-glow-red`

### Typography

| Class          | Font              | Use                                                      |
| -------------- | ----------------- | -------------------------------------------------------- |
| `font-display` | Plus Jakarta Sans | Section headings (h2, SectionHeading), hero labels       |
| `font-body`    | Plus Jakarta Sans | Body text, descriptions, labels (same family as display) |
| `font-mono`    | JetBrains Mono    | Tickers, scores, numbers, data values, mono labels       |

Global default weight: `300`. Heading overrides: `h1–h3 → 700`, `h4–h6 → 600`. Loaded via Google Fonts in `index.html`.

### Report Layout (Report.tsx)

- Hero: `flex flex-col sm:flex-row` — left `flex-1 min-w-0`, right `flex-shrink-0 max-w-xs sm:max-w-sm`
- Body: `grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start`
- Right column: `lg:sticky lg:top-6`

## Known Pitfalls

- **Thesis word-per-line bug**: `report_json.thesis` may be an array in older reports. Always coerce: `Array.isArray(v) ? v.join(' ') : String(v)` before rendering. Apply `block w-full whitespace-normal break-words` to the thesis `<p>`.
- **Sector tag overflow**: right hero column must have `max-w-xs sm:max-w-sm` — otherwise many sector tags overflow and collapse the left (thesis) column to 0px width.
- **`normPct()` guard**: `gross_margin` and `yoy_growth` may be stored as decimals (0.39) or percentages (39.0). If `|value × 100| > 200`, use the value as-is.
- **PipelineProgress cached steps**: `SSEEvent.status` can be `'cached'` (from smart update). Treat `cached` the same as `complete` for step tracking; render with a circular-arrow icon instead of a checkmark.
- **BusinessDiagram**: React Flow was removed. The component is now pure React/Tailwind — 4 zones: MoatZone, BusinessZone (3 cols), CustomerZone, RiskZone. Export via `html-to-image` toPng.
- **Risk zone red pattern**: both `BearCase.tsx` Key Risks and `BusinessDiagram.tsx` RiskZone use `border-l-4 border-red-500` left accent only — NOT a red background. Title text is `text-white font-semibold`, body is `text-slate-300 font-light`, icon/label stays `text-red-400`.
- **ManagementRating optional field**: `rj.management_rating` is absent in reports generated before v0.5.2. Always gate with `{rj.management_rating && <ManagementRating data={rj.management_rating} />}` — no fallback render needed.
- **Tailwind v4 `@theme` + config**: custom tokens live in both `tailwind.config.ts` (for IDE autocomplete) and the `@theme {}` block in `index.css`. Keep both in sync when adding new tokens.
- **Purple vs gold rule**: purple (`text-purple`, `border-purple`, etc.) for all interactive chrome. Gold (`text-gold`) for financial data display only — never on buttons, tabs, or nav elements.
- **`ResearchListItem` vs `ResearchReport`**: `useReportList()` returns `ResearchListItem[]` — a flat, enriched shape from the list API. It has `upside_percent`, `target_price`, `hot_sector_match`, `company_name`, `sector` as top-level fields (no nested `tickers`). `ResearchReport` is for single-report fetches only. Never use `report.tickers?.company_name` on list items.
- **Filter bar state lives in Home.tsx**: `minScore`, `minUpside`, `sectorFilter`, `sortBy` — all client-side, no query key changes. `filtered` is a derived array from `reportList`. The "Clear Filters" button is only shown when `isFiltered` is true (any non-default filter active).
- **v2-only optional fields** (`scenarios`, `platform_optionality`, `rerating_catalyst`, `bear_case_rebuttal`): all absent in pre-v2 reports. Each is gated with `{rj.field && <... />}` in `Report.tsx` — no fallback render. `Scenarios.tsx` additionally null-guards `target_price`/`upside_percent` within each scenario row (e.g. closed-end funds have no revenue-based valuation) — render `—`, never `$null`.
- **`NapkinMath` comp selector assumes P/S-driven scenarios**: `buildCompOptions()` (`lib/napkinMath.ts`) derives a constant `k = target_price ÷ comp_multiple` from the primary napkin_math figures and applies it to any OTHER valuation-table peer's `ps_ratio` to extrapolate a target price. This is only valid because the backend (since v0.8.6) enforces `comp_multiple === valuation_table[peer].ps_ratio` for every scenario. Never assume this holds for reports generated before that fix — the selector only extrapolates for peers not already covered by a scenario, so old inconsistent data doesn't surface visibly wrong numbers, but don't build new features on top of this assumption without re-checking it.

## Commands

```bash
npm run dev        # Vite dev server — port 5173
npm run build      # Vite production build
npm run preview    # Preview production build locally
npm run test       # Vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint src/**/*.tsx
```

## Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:3001
```

## Mobile Rules (iPhone 16 Plus — 430px)

- Root page containers: `overflow-x-hidden w-full`
- Multi-column layouts: `grid-cols-1` default, `lg:grid-cols-N` for wide
- Tables: always wrap in `overflow-x-auto` with `min-w-[Npx]` on table
- Canvas/diagram: wrap in `overflow-x-auto max-w-full`
- Buttons: `w-full sm:w-auto` for primary CTAs
- Padding: `px-4` default, `sm:px-6 lg:px-8`

## Testing Rules

- Test every custom hook with React Testing Library
- Test every form validation path (valid ticker, invalid ticker, empty)
- Test role-based rendering: components that hide/show based on role
- Mock Supabase client and API calls in all tests
- No snapshot tests — test behaviour not markup
- Test all parser functions (`parseNumberedList`, `parseMoatPoints`, `parseBullets` in `lib/parsers.ts`; `normPct` in `lib/normPct.ts`; `buildCompOptions` in `lib/napkinMath.ts`) for edge cases — currently covered, hook/component tests with React Testing Library are not yet set up (only pure-function unit tests exist so far)
