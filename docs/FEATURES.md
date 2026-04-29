# FEATURES.md — moat-finder

## Product Vision

moat-finder helps investors identify asymmetric risk/reward opportunities by
generating AI-powered, web-grounded research reports on any stock ticker.
Reports are cached, versioned, publicly readable, and diff-tracked on update.

---

## User Roles

| Role     | Can Do                                                           |
| -------- | ---------------------------------------------------------------- |
| Public   | Search cached tickers, view cached reports, view version history |
| Pending  | Logged in but awaiting admin approval — same as public           |
| Approved | Everything public + trigger new research + trigger updates       |
| Admin    | Everything approved + approve/reject users + view audit log      |

---

## Feature 1 — Home / Ticker Search

**Public access — no login required**

- Landing page with a prominent search input: "Enter a stock ticker (e.g. SKYT)"
- Search input is uppercase-enforced, max 10 characters
- On submit:
  - Backend checks `public.tickers` for the symbol
  - **Cache hit**: navigate to report page immediately — no AI call
  - **Cache miss + user unauthenticated**: show message
    "This ticker hasn't been researched yet. Log in to run a new research."
  - **Cache miss + user authenticated + approved**: show confirmation modal
    "Research [TICKER]? This will use AI credits. Confirm to proceed."
  - **Cache miss + user authenticated + pending/rejected**: show message
    "Your account is awaiting admin approval."
- Show a browsable grid/list of all previously researched tickers with:
  - Ticker symbol + company name
  - Score badge (colour-coded: 8–10 green, 5–7.9 yellow, <5 red)
  - Last researched date
  - Sector tags

---

## Feature 2 — Research Report Page

**Public access — no login required for cached reports**

### Report Header

- Ticker symbol (large), company name, score badge
- Last researched date + "Updated X days ago"
- Version indicator: "Version 3 — last updated 12 Jan 2026"
- **Update button** (visible to approved users only) — triggers Feature 4

### Report Sections (in order)

1. **One-liner thesis** — italic callout with purple left border
2. **Business Model Diagram** — pure React/Tailwind 4-zone canvas (moat → business → customers → risks); no React Flow
3. **Sector Heat Check** — 1–5 flame icons + hot sector tags
4. **Business Model Narrative** — how the company makes money (numbered segments)
5. **Why Now (Catalysts)** — numbered list of 3–5 upcoming catalysts
6. **Moat & Competitors** — pillar cards + competitor tags
7. **Bear Case** — numbered risk points + Key Risks with title/body parsing
8. **Macro & Policy** — macro tailwinds/headwinds (bullet list)
9. **Sentiment & Technicals** — short interest, 200-day MA, RS vs SPY (bullet list)
10. **Version History** — changelog accordion (if >0 versions)

**Right sidebar (sticky on desktop):**

- **Napkin Math** — target price + upside stacked vertically; Revenue Guidance + Comp Multiple below
- **Quarterly Results** — last 4 quarters earnings table
- **Valuation vs Peers** — comparison table (P/S, EV/EBITDA, gross margin, YoY growth)
- **Sector Heat** — flame icons + hot sector chips
- **Management Rating** — independent A–F grade assessment; not included in investment score

### Report Footer

- "Research triggered by [username] on [date]"
- "View version history" link → Feature 5

---

## Feature 3 — New Research Pipeline

**Authenticated + approved users only**

### Trigger

- User confirms research modal on ticker search (cache miss flow)
- POST `/api/v1/research/:ticker`

### Experience

- Page transitions to a "Research in Progress" view
- Progress indicator shows each pipeline step completing in real time via SSE:

  ```
  ✓ Step 1 — Discovery (company identified)
  ✓ Step 2 — Deep Dive
  ✓ Step 3 — Valuation & Financials
  ✓ Step 4 — Risk Red Team
  ✓ Step 5 — Macro & Sector
  ✓ Step 6 — Sentiment & Technicals
  ⟳ Step 7 — Synthesising report...
  ```

- Each step streams a brief status message as it completes
- On completion: redirect to report page automatically
- On error: show specific step that failed, offer retry

### Backend Behaviour

1. Verify JWT — reject if not approved
2. Check cache again (race condition guard)
3. Write audit log: `research_triggered`
4. Run 7-step pipeline sequentially
5. On Step 7 completion: write to `research_reports` + `research_versions` (v1)
6. Update `tickers` table: `research_count++`, `last_researched_at`
7. Stream final completion event to frontend

---

## Feature 4 — Update Research (Diff + Changelog)

**Authenticated + approved users only**

### Trigger

- "Update Research" button on report page (approved users only)
- PUT `/api/v1/research/:ticker`

### Experience

- Same SSE progress view as Feature 3 (all 7 steps run again)
- On completion: show a **diff modal** before saving:
  - Score: 7.2 → 8.1 ↑
  - Changed sections listed (e.g. "Napkin Math updated", "New catalyst added")
  - Human-readable summary from Step 7
  - "Confirm and Save" or "Discard" buttons
- On confirm: save new version, update `research_reports`, write diff to `research_versions`
- Report page shows updated content immediately

### Diff Display on Report Page

- Persistent changelog section at bottom of report:

  ```
  Version 3 — Updated 12 Jan 2026 by rocky
    Score changed: 7.2 → 8.1
    Added catalyst: "Fab 25 revenue guidance raised"
    Napkin Math updated

  Version 2 — Updated 3 Dec 2025 by rocky
    Bear case updated
  ```

---

## Feature 5 — Version History

**Public access**

- Page: `/research/:ticker/versions`
- List of all versions with: version number, date, researched by, score, brief diff summary
- Click any version to view the full report at that point in time (read-only)
- Visual diff between any two selected versions (side-by-side key field comparison)

---

## Feature 6 — Business Model Diagram

**Embedded in report page**

- Rendered with React Flow
- Interactive: pan, zoom, click nodes for detail
- Node types with distinct colours:
  - Green: Revenue streams (with $ amount if available)
  - Blue: Customers / end markets
  - Orange: Moat / competitive advantage
  - Purple: Business units / products
  - Red: Key risks
- Edges show relationships (e.g. "serves", "protects", "depends on")
- Export button: download diagram as PNG
- Mobile: pinch-to-zoom supported; diagram scrollable within its container

---

## Feature 7 — Authentication

### Login / Register Flow

- "Log in" button in nav → Supabase Auth modal
- Federated login options: Google, Apple, Twitter/X
- On first login: account created with `role = 'pending'`
- User sees: "Your account is pending admin approval. You'll be notified when approved."
- On approval: user can immediately trigger research (no re-login required)

### Session Management

- Session persisted via Supabase Auth JS (handles refresh automatically)
- Nav shows: avatar + display name when logged in
- "Log out" clears session

---

## Feature 8 — Admin Panel

**Admin role only — route: `/admin`**

### User Management Tab

- Table of all users: name, email, role, joined date, last active
- Filter by role: pending / approved / rejected
- Approve button → sets `role = 'approved'`, writes audit log `user_approved`
- Reject button → sets `role = 'rejected'`, writes audit log `user_rejected`
- Pending count badge in nav for admin users

### Audit Log Tab

- Paginated table: timestamp, action, ticker, user, IP address, metadata
- Searchable by: ticker symbol, user name/email, action type, date range, IP
- Export to CSV button
- Columns: Timestamp | Action | Ticker | User | IP Address | Details
- Sorted by newest first by default

---

## Feature 9 — Mobile Responsive Design

**Applies to all pages**

- Breakpoints: mobile (<640px), tablet (640–1024px), desktop (>1024px)
- Navigation: hamburger menu on mobile
- Report sections: stack vertically on mobile
- Valuation table: horizontally scrollable on mobile
- React Flow diagram: touch-enabled pan/zoom; minimum height 300px on mobile
- Score badges, sector tags: appropriately sized for touch targets (min 44px)
- Fonts: readable at all sizes, no text smaller than 14px on mobile

---

## Feature 10 — Security Hardening

- All API keys server-side only — never in frontend bundle
- CORS: only Vercel frontend origin whitelisted on backend
- Helmet.js on Express: sets security headers
- Rate limiting: express-rate-limit on all routes; stricter on research trigger
- Input validation: ticker symbols validated (uppercase letters only, 1–10 chars)
  using Zod on both frontend and backend
- Supabase RLS: enforced at database level as final safety net
- `.claudeignore` prevents Claude Code from reading `.env` files
- Audit log IP: always from `CF-Connecting-IP` header

---

## Non-Features (Explicitly Out of Scope)

- No real-time stock price feed
- No portfolio tracking
- No buy/sell execution
- No email notifications (future iteration)
- No multi-language support
- No dark mode (future iteration)
- No self-serve registration — admin approval required
