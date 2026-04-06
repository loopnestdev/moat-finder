# CLAUDE.md — moat-finder

---

## Project Purpose

A web application that takes an input of a stock ticker and generate a detailed report about requested company.

The idea behind this web application is to find the companies that have asymmetric setup.

---

## Architecture
| Layer | Tools | Reason |
| --- | --- | --- |
| Frontend | React + Tailwind CSS |
| Frontend hosting | Vercel |
| Backend | Node.js + Express |
| Backend hosting | Render |
| Security layer | CloudFlare |
| Auth | Supabase Auth |
| Database | Supabase (Postgres) |
| Diagram | React Flow |
| AI | Claude API + Web search |

---

## Hard Constraints

1. **Minimize external dependencies** — standard libraries only if posible. If not, then use only the most popular and trusted libraries.
2. **Modular approach** — frontend, backend, AI brain (Claude API (claude-sonnet-4-6) with web_search tool).
3. **Use popular and trusted frontend and backend hosting** — Easy to deploy and redeploy for any update from repository.
4. **Security is always number one priority** — develop and build a solution that is secured and hardened including the choise of language.
5. **CloudFlare sits in front of everything** — It would give us DDoS protection, bot detection, rate limiting, and SSL termination.
6. **Mobile friendly access** — The web design must be responsive and beautiful from both computer and mobile phone.
7. **Support authentication** — Only authenticated users are allowed to research for the stock if it's not researched already as it involved token usage. And not everyone can register for an account. An admin must approve for the new user before use. Support federated authentication from Apple, Google directory, and twitter or X.
8. **Anyone can search for cached research** - For stocks that are already research by authenticated users, those stocks are open for public to see the reports
9. **Support for update button for cached research with diff/changelog** - There should be an update button where research can be updated only by an authenticated user. The updates should indicate what is changing since the last time research was completed with the data of a research, and date of last updated
10. **Audit logging** - When enabled, who triggers the research, who triggers the update, who did the query only, source of IP address, ticker, timestamp etc. The audit log is displayable on the frontend and searchable.
11. **Support beautiful diagrams** - When generating the report with the diagrams, it must be how the company makes money.

---

## File Layout

```
moat-finder/
├── CLAUDE.md                    # Master briefing for Claude Code
├── docs/
│   ├── ARCHITECTURE.md          # System design
│   ├── DATABASE.md              # Schema source of truth
│   └── FEATURES.md              # Product requirements
├── backend/
│   ├── CLAUDE.md                # Backend-specific rules
│   └── src/
├── frontend/
│   ├── CLAUDE.md                # Frontend-specific rules
│   └── src/
└── .claude/
   ├── settings.json            # Hooks and permissions
   └── skills/                  # Reusable Claude skills
```

---

## Language & Runtime

- TypeScript strict mode throughout — no `any` types ever
- Node.js v20 LTS (backend)
- Package manager: npm

## Commands

- `npm run dev` — start backend dev server (port 3001)
- `npm run dev` — start frontend dev server (port 5173, Vite)
- `npm run build` — production build
- `npm run test` — run test suite (Vitest)
- `npm run typecheck` — TypeScript type-check with no emit
- `npm run lint` — ESLint check

## How Claude Verifies Changes

1. Run `npm run typecheck` — must pass with zero errors
2. Run `npm run test` — all tests must pass
3. Run `npm run lint` — no lint errors
Never leave failing type errors or tests. Fix before moving on.

## Key Decisions

- API keys live in `.env` files only — NEVER hardcoded, NEVER committed
- All backend routes are prefixed `/api/v1/`
- Cloudflare CF-Connecting-IP header is used for real IP logging (not req.ip)
- Research pipeline is sequential (7 steps), not parallel — order matters for context
- Supabase Row Level Security is enabled on all tables — never bypass with service key in user-facing routes

---

## Known Pitfalls (Lessons Learned)

If any.

---

## Test Strategy

- Generate unit tests always as required
- Every parser code path has a test

---
