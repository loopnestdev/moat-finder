# CLAUDE.md — moat-finder/frontend

Read docs/ARCHITECTURE.md, docs/FEATURES.md, and docs/DATABASE.md before
making any changes to the frontend.

---

## Stack

- React 18 + Vite + TypeScript strict
- Tailwind CSS v3 — mobile-first, all layout via Tailwind utilities only
- React Router v6 — client-side routing
- TanStack Query (React Query) v5 — all server state, caching, loading states
- Supabase Auth JS v2 — session management, OAuth
- React Flow v11 — business model diagram rendering
- Zod — ticker input validation (shared schema with backend)

## Folder Structure

```
frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Router setup, auth provider
│   ├── pages/
│   │   ├── Home.tsx          # Ticker search + researched tickers grid
│   │   ├── Report.tsx        # Full research report page
│   │   ├── Versions.tsx      # Version history page
│   │   ├── Admin.tsx         # Admin panel (users + audit log)
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Nav.tsx       # Responsive navbar with auth state
│   │   │   └── Layout.tsx    # Page wrapper
│   │   ├── report/
│   │   │   ├── ScoreBadge.tsx
│   │   │   ├── SectorHeat.tsx
│   │   │   ├── ValuationTable.tsx
│   │   │   ├── NapkinMath.tsx
│   │   │   ├── BearCase.tsx
│   │   │   ├── Changelog.tsx
│   │   │   └── BusinessDiagram.tsx   # React Flow diagram
│   │   ├── research/
│   │   │   ├── PipelineProgress.tsx  # SSE progress display
│   │   │   └── DiffModal.tsx         # Update confirmation modal
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Badge.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useAuth.ts        # Supabase session + role
│   │   ├── useResearch.ts    # TanStack Query for report fetch
│   │   └── usePipeline.ts    # SSE connection management
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client (anon key only)
│   │   ├── api.ts            # fetch wrapper for backend API calls
│   │   └── validation.ts     # Zod schemas (ticker, etc.)
│   └── types/
│       └── report.types.ts   # mirrors backend report types
├── .env.example
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Key Rules

1. **Mobile-first always** — write Tailwind classes mobile-first, use `sm:`,
   `md:`, `lg:` prefixes for larger breakpoints. Never design desktop-first.

2. **No inline styles** — all styling via Tailwind utility classes only.
   No `style={{}}` props except for React Flow node positioning.

3. **TanStack Query for all data fetching** — no raw `useEffect` + `fetch`
   patterns. Every API call goes through a query or mutation hook.

4. **Auth state from `useAuth` hook only** — never read Supabase session
   directly in components. Always use the `useAuth` hook.

5. **Anon key only in frontend** — `VITE_SUPABASE_ANON_KEY` only.
   Service role key must never appear in frontend code.

6. **SSE via `usePipeline` hook** — encapsulates EventSource lifecycle,
   cleanup on unmount, error handling. Never create EventSource directly
   in components.

7. **Accessible UI** — all interactive elements have proper ARIA labels.
   Minimum touch target size 44×44px on mobile. Keyboard navigable.

8. **React Flow diagram** — use `BusinessDiagram.tsx` component only.
   Node colours: green=revenue, blue=customer, orange=moat,
   purple=business_unit, red=risk. Always enable touch events for mobile.

## Design System

- **Colours**: defined in `tailwind.config.ts` — use semantic names
  (e.g. `score-high`, `score-mid`, `score-low`, `moat`, `revenue`)
- **Score badge colours**:
  - 8.0–10.0: green (`bg-emerald-500`)
  - 5.0–7.9: yellow (`bg-amber-400`)
  - 1.0–4.9: red (`bg-red-500`)
- **Typography**: use Tailwind's `font-mono` for ticker symbols, `font-sans`
  for body text
- **Spacing**: consistent 4-point grid via Tailwind spacing scale

## Commands

```bash
npm run dev        # vite dev server — port 5173
npm run build      # vite build → dist/
npm run preview    # preview production build locally
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src/**/*.tsx
```

## Environment Variables

Copy `.env.example` to `.env.local` — never commit `.env.local`.

```
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
