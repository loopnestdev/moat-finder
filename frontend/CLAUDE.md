# CLAUDE.md — moat-finder/frontend

Read docs/ARCHITECTURE.md, docs/FEATURES.md, and docs/DATABASE.md before
making any changes to the frontend.

---

## Stack

- React 18 + Vite + TypeScript strict
- Tailwind CSS v3 — mobile-first, all layout via Tailwind utilities only
- React Router v6 — client-side routing
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
│   │   │   ├── Nav.tsx       # Responsive navbar — dark navy, gold logo
│   │   │   └── Layout.tsx    # Page wrapper (bg-navy-900)
│   │   ├── report/
│   │   │   ├── ScoreBadge.tsx       # SVG circular gauge (sm/md/lg)
│   │   │   ├── SectorHeat.tsx       # SVG flame icons + sector chips
│   │   │   ├── ValuationTable.tsx   # 2-col card grid (subject highlighted)
│   │   │   ├── NapkinMath.tsx       # Target price + upside hero card
│   │   │   ├── BearCase.tsx         # Numbered red card
│   │   │   ├── Changelog.tsx        # Dark navy version history accordion
│   │   │   ├── BusinessDiagram.tsx  # 4-zone pure-React canvas (no React Flow)
│   │   │   └── QuarterlyResults.tsx # Last 4 quarters earnings card
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
│   │   └── validation.ts     # Zod schemas (ticker, etc.)
│   └── types/
│       └── report.types.ts   # Mirrors backend report types
├── public/
│   └── favicon.svg           # Moat-finder icon mark (navy + gold rings)
├── tailwind.config.ts
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

### Colours (tailwind.config.ts)

```text
navy:  950=#070d1a  900=#0f1729  800=#162035  700=#1e2d47  600=#2a3f5f
cream: DEFAULT=#f5f0e8  muted=#b8b0a0  subtle=#7a7268
gold:  DEFAULT=#c9a84c  light=#e4c97e  dark=#9a7530
```

Score badge thresholds:

- 8.0–10.0: `text-emerald-400` / `animate-pulse-glow-emerald`
- 5.0–7.9: `text-amber-400` / `animate-pulse-glow-amber`
- 1.0–4.9: `text-red-400` / `animate-pulse-glow-red`

### Typography

| Class | Font | Use |
| --- | --- | --- |
| `font-display` | Playfair Display | Section headings (h2, SectionHeading) |
| `font-body` | Inter | Body text, descriptions, labels |
| `font-mono` | JetBrains Mono | Tickers, scores, numbers, data values |

### Report Layout (Report.tsx)

- Hero: `flex flex-col sm:flex-row` — left `flex-1 min-w-0`, right `flex-shrink-0 max-w-xs sm:max-w-sm`
- Body: `grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start`
- Right column: `lg:sticky lg:top-6`

## Known Pitfalls

- **Thesis word-per-line bug**: `report_json.thesis` may be an array in older reports. Always coerce: `Array.isArray(v) ? v.join(' ') : String(v)` before rendering. Apply `block w-full whitespace-normal break-words` to the thesis `<p>`.
- **Sector tag overflow**: right hero column must have `max-w-xs sm:max-w-sm` — otherwise many sector tags overflow and collapse the left (thesis) column to 0px width.
- **`normPct()` guard**: `gross_margin` and `yoy_growth` may be stored as decimals (0.39) or percentages (39.0). If `|value × 100| > 200`, use the value as-is.
- **PipelineProgress cached steps**: `SSEEvent.status` can be `'cached'` (from smart update). Treat `cached` the same as `complete` for step tracking; render with a gold circular-arrow icon instead of a green checkmark.
- **BusinessDiagram**: React Flow was removed. The component is now pure React/Tailwind — 4 zones: MoatZone, BusinessZone (3 cols), CustomerZone, RiskZone. Export via `html-to-image` toPng.
- **`font-body` on Update Research button**: Button.tsx uses `text-sm` by default; override with `!text-base` in the className prop when larger text is needed.

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

## Testing Rules

- Test every custom hook with React Testing Library
- Test every form validation path (valid ticker, invalid ticker, empty)
- Test role-based rendering: components that hide/show based on role
- Mock Supabase client and API calls in all tests
- No snapshot tests — test behaviour not markup
- Test all parser functions (`parseNumberedList`, `parseBullets`, `normPct`, `extractGuideNumbers`) for edge cases
