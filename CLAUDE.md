# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-page app for a Vietnamese company tour-registration event ("Tour Du Lịch Vùng
Trung Bộ 2026"). An employee enters their staff ID (MSNV), picks a tour for their
pre-assigned destination, registers companions + transport, and gets a downloadable
event ticket (PNG). A password-gated `/admin` panel imports the employee roster from
Excel, edits tour capacity/pricing, and exports registrations.

All user-facing copy is Vietnamese — keep new strings Vietnamese and in the same tone.

## Commands

```sh
npm run dev        # Vite dev server — frontend only, /api/* routes DO NOT run
vercel dev         # full stack: frontend + api/ serverless functions (use this for anything touching /api)
npm run build      # tsc -b (all three tsconfig projects) then vite build
npm run lint       # oxlint (not eslint)
npm run preview    # serve the built dist/
```

No test suite exists and none is expected — validation is manual QA (see
`docs/superpowers/specs/`). Do not add a test framework unless asked.

## Architecture

### Frontend (`src/`)
- **React 19 + Vite + react-router-dom v6**, Tailwind v3, shadcn/ui components in
  `src/components/ui/`, `@` path alias → `src/`.
- **Routing is URL-as-state**: `src/App.tsx` maps five routes to a single
  `WizardPage`. `WizardPage` derives the current wizard step (`welcome` → `tours` →
  `register` → `ticket`) purely from `location.pathname` and refetches employee /
  tour / registration data from the URL params on each step. There is no shared
  wizard store — navigation drives everything.
- **Data access lives in `src/lib/api.ts`.** Public reads (`tours` table,
  `find_employee_by_id`, `get_registration_by_employee`) go **directly to Supabase**
  via the browser client (`src/lib/supabase/client.ts`). Privileged operations
  (registration submit, all admin actions) go through `fetch('/api/...')`.
- `src/types/domain.ts` is the canonical shape of every entity. `api.ts` maps raw
  DB rows to these types.
- `src/lib/pricing.ts`: `classifyAge` (child = under 10) and total-price calc,
  mirrored server-side in the `submit_registration` SQL function.
- Ticket image download uses `html-to-image` (`toPng`) on `EventTicket`
  (`src/components/ticket/`, styled with `ticket.less`). Excel import/export uses
  `xlsx` / `exceljs` in the browser.
- Realtime: `TourSelectionScreen` subscribes to Postgres changes on `tours` to keep
  remaining-capacity counts live.

### Backend (`api/` — Vercel serverless functions)
- `api/register.ts` — public endpoint, calls the `submit_registration` RPC.
- `api/admin/*` — every route calls `requireAdminSession(req, res)` from
  `api/_lib/adminSession.ts` first and `return`s on false.
- **Admin auth is a self-contained HMAC cookie**, not Supabase Auth:
  `/api/admin/login` checks `ADMIN_PASSWORD`, then sets an HttpOnly `admin_session`
  cookie signed with `ADMIN_SESSION_SECRET` (`admin.<expiry>.<hmac>`, 8h TTL).
- All server-side DB access uses the **service-role client** `supabaseAdmin` from
  `src/lib/supabase/server.ts` (bypasses RLS). The commented-out SSR cookie client
  at the top of that file is dead scaffolding — ignore it.
- **`api/` imports use explicit `.js` extensions** on relative paths
  (`../_lib/adminSession.js`) even though the files are `.ts` — required for Vercel's
  ESM serverless runtime. Keep this convention or the deploy build breaks.
- `api/` is compiled by `tsconfig.api.json` (separate project, Node types only);
  `src/` by `tsconfig.app.json`. `tsconfig.api.json` also pulls in
  `src/lib/supabase/server.ts` and `src/types/domain.ts`.

### Database (`supabase/migrations/`)
- Apply migrations manually in the Supabase SQL editor (no CLI linked here). Run
  `0001_init.sql` first; it creates schema, RLS, RPCs, enables Realtime on `tours`,
  and seeds 5 tours.
- **Security model**: `employees` / `registrations` / `companions` have RLS with
  **no anon policies** → all direct client access denied. Clients reach them only
  through `SECURITY DEFINER` RPC functions that match on an exact ID (prevents
  enumeration). Bulk listing/export is service-role-only via `/api/admin/*`.
- **Column-naming caveat**: `0001_init.sql` defines quoted **camelCase** columns to
  match `domain.ts` 1:1. Later migrations (`0002+`) and some API routes
  (`api/admin/tour-config.ts`) instead use **snake_case** (`max_capacity`, etc.).
  `api.ts` defensively reads both (`getValue(raw, camelKey, snakeKey)`). Check which
  column style the target Supabase project actually uses before writing queries.
- Migrations `0002`–`0006` are hotfixes iterating on one thing: the
  `submit_registration` function (capacity = 1 employee slot + adult companions;
  int-vs-text `tourId` casting; empty-companions handling; resolving a PostgREST
  overload ambiguity). `0002` and `0003` both touch capacity logic — `0003` supersedes.

## Environment

`cp .env.example .env.local`, then fill in. `VITE_*` vars ship to the browser
(protected by RLS); `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET` are server-only. Set the same set in the Vercel dashboard for
Production + Preview. The `employees` table starts empty — import via `/admin` before
end-to-end testing the wizard.

## Domain rules (keep frontend + `submit_registration` SQL in sync)

- Max companions: 2 adults + 2 children.
- Child = under 10 years old at time of registration.
- One registration per employee (`employeeId` is unique).
- Transport is `self` or `tour_bus`; `pickupPoint` is one of 7 fixed provinces and
  only meaningful for `tour_bus`.
- Capacity consumed per registration = 1 (employee) + number of adult companions.
