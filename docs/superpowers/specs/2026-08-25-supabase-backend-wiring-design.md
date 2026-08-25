# Design Specification: Supabase Backend Wiring

Date: 2026-08-25
Status: Approved

## 1. Overview

The tour registration website was built as a UI-only implementation (see
`2026-08-24-tour-registration-design.md`) backed by an in-memory mock data
seam (`src/lib/mockData.ts`). This spec covers wiring that seam to a real
Supabase (Postgres) backend and Vercel serverless functions, per the
architecture already approved in the original design's §2-3.

This is a single, complete backend-wiring pass — not phased. No automated
test suite is added (consistent with the prior UI-only decision); validation
remains manual QA, extended to cover the real deployment.

Prerequisites (user-owned, not part of this implementation): an existing
Supabase project, and a Vercel account/project to be connected. Neither CLI
is available in this environment — all Supabase/Vercel-side setup steps
(running migrations, setting env vars, connecting the Vercel project) are
executed manually by the user following the checklist in §6.

**Existing scaffolding to build on:** `@supabase/supabase-js` and
`@supabase/ssr` are already added to `package.json`, and
`src/lib/supabase/client.ts` (browser client via `createBrowserClient`)
already exists and is reused as-is for the client-side reads (`tours`
table, `find_employee_by_id`, `get_registration_by_employee` RPCs). The
existing `src/lib/supabase/server.ts` was scaffolded for Supabase
Auth-style SSR cookie sync (`createServerClient` + `parseCookieHeader`),
which doesn't match this design's server-side needs — the serverless
functions use a plain service-role client (`createClient` from
`@supabase/supabase-js`, no cookie syncing) since privileged access is
authorized by the service-role key itself, not a Supabase Auth session.
The implementation plan replaces `server.ts`'s contents with this
service-role client factory (same file path, new implementation) rather
than adding a separate file.

## 2. Data Access Security Model

Refining the original spec's "frontend reads directly via the Supabase JS
client for public data" to close an enumeration gap: Postgres RLS cannot
restrict "only the row matching an ID you provide" — a client can always
drop a filter and list everything a `SELECT` policy allows. So:

- **`tours`** — RLS open `SELECT` for `anon`/`authenticated` (not sensitive;
  also needed for the Realtime capacity subscription). Writes restricted to
  `service_role` only.
- **`employees`** — RLS denies all direct anon/authenticated access. Exposed
  only via a `SECURITY DEFINER` function `find_employee_by_id(p_id text)` —
  an exact-match lookup, no enumeration possible. Writes restricted to
  `service_role` (via the import serverless function).
- **`registrations` + `companions`** — RLS denies all direct anon/
  authenticated access. Exposed only via a `SECURITY DEFINER` function
  `get_registration_by_employee(p_employee_id text)`, used for the "already
  registered → show ticket" flow. Full listing (admin table + export) goes
  through a service-role-gated serverless endpoint only — never direct
  client access.
- **Registration submission** stays as originally designed: one atomic
  Postgres function (`submit_registration`), invoked from a Vercel
  serverless function using the service-role key, performing the capacity
  check + insert + increment in a single transaction.

## 3. Database Schema & Migrations

SQL migration file(s) under `supabase/migrations/`, implementing the data
model already specified in the original design's §3 (`employees`, `tours`,
`registrations` with a unique `employee_id`, `companions` with a FK to
`registrations`), plus:

- **Functions:**
  - `submit_registration(...)` — `SECURITY DEFINER`. Single transaction:
    checks `registered_count < max_capacity`, inserts the registration row
    and its companion rows, increments `tours.registered_count` by a flat
    `+1` per registration (matching the existing UI-only mock's behavior —
    capacity is counted per registration submitted, not per person).
    Returns the created registration, or an error the serverless function
    translates to `{ ok: false, error }`.
  - `find_employee_by_id(p_id text)` — `SECURITY DEFINER`, exact-match
    lookup only.
  - `get_registration_by_employee(p_employee_id text)` — `SECURITY
    DEFINER`, returns the registration + companions for one employee.
- **RLS policies:** per §2 above.
- **Seed script:** one-time SQL insert for the 5 tour rows (1 Đà Lạt, 4 Nha
  Trang) with the exact capacities/dates/pricing from the original spec's
  Global Constraints — tours aren't Excel-imported, so they need a seed
  rather than relying on the admin UI to create rows from scratch.

## 4. Serverless Functions (Vercel `/api` routes)

All under `api/` (Vercel's file-based routing convention), all using the
Supabase service-role client server-side only (the service-role key never
reaches the client bundle):

1. **`POST /api/admin/login`** — body `{ password }`; compares against
   `process.env.ADMIN_PASSWORD`. On match, sets an httpOnly signed session
   cookie (HMAC-signed opaque token, short expiry, signed with a
   server-only `ADMIN_SESSION_SECRET` — no JWT library dependency needed).
   401 on mismatch.
2. **`GET /api/admin/session`** — checks the cookie, returns
   `{ authenticated: boolean }`. Called once on `AdminPage` mount so a page
   refresh doesn't force re-login.
3. **`POST /api/register`** — body: the registration payload (employeeId,
   tourId, transportMethod, pickupPoint, companions). Re-validates shape
   server-side (defense in depth), calls `submit_registration`. Returns
   `{ ok: true, registration }` / `{ ok: false, error }` — same contract
   shape as today's mock `submitRegistration`, so `RegistrationFormScreen`
   requires no contract changes.
4. **`POST /api/admin/import-employees`** — admin-session-gated. Body:
   employee rows (client still parses the uploaded `.xlsx` with `xlsx`,
   same as today, then POSTs the parsed rows). Validates + upserts by `id`.
   Returns `{ imported, errors }` — same contract as today's mock
   `importEmployees`.
5. **`POST /api/admin/tour-config`** — admin-session-gated. Body
   `{ tourId, changes }`. Updates the tour row via service role.
6. **`GET /api/admin/registrations`** — admin-session-gated. Returns the
   full joined registrations+employee+tour+companions listing (bypasses
   RLS via service role, since this needs full visibility across all
   employees' data).
7. **`GET /api/admin/export-registrations`** — admin-session-gated.
   Generates and streams the `.xlsx` binary server-side (Node `xlsx` API);
   client downloads the returned blob.

All admin endpoints share one `requireAdminSession(req)` helper that
verifies the signed cookie and returns 401 if invalid/expired/missing.

## 5. Async Migration of Existing UI Call-Sites

Today's mock functions in `src/lib/mockData.ts` are synchronous. Every real
replacement becomes a network call (`Promise`-based), so this plan updates
every consumer to handle loading/error states — this was flagged as a
known gap by the final review of the prior UI-only plan.

`findEmployeeById`, `findRegistrationByEmployeeId`, `getToursByDestination`,
`getTourById`, `getAllTours`, `getAllRegistrationsWithDetails` all become
`async`/return `Promise<...>` (same return shapes as today, just wrapped in
a Promise). Affected call-sites:

- **`WelcomeScreen.tsx`** — lookups already run inside a click handler;
  `await` them, add a disabled/spinner state on "Kiểm tra" while pending,
  and a distinct network-error alert separate from the existing
  "not found" business message.
- **`TourSelectionScreen.tsx`** — `getToursByDestination` needs a
  `useEffect` + loading skeleton + error state (with retry). Also gains a
  Realtime subscription: `postgres_changes` on `tours` filtered by
  destination, merging incoming capacity updates into local state,
  unsubscribed on unmount.
- **`TicketScreen.tsx`** — `getTourById` needs the same `useEffect` +
  loading/error treatment.
- **`TourConfigTable.tsx`** (admin) — `getAllTours` needs `useEffect` +
  loading/error + a refetch after each row save.
- **`RegistrationsTable.tsx`** (admin) — now calls
  `/api/admin/registrations` with `credentials: "include"` so the session
  cookie is sent; needs loading/error state.
- **`RegistrationFormScreen.tsx`** — `submitRegistration` already has an
  in-flight state (built in the prior plan); minimal change — a real fetch
  replaces the mock's artificial delay.
- **`EmployeeImportPanel.tsx`** — `importEmployees` becomes a real POST;
  already a user-triggered action, needs a loading state added during the
  request.
- **`AdminPage.tsx`** — login now calls `POST /api/admin/login` instead of
  a local constant comparison; also calls `GET /api/admin/session` once on
  mount to preserve the session across a refresh.

## 6. Environment Variables & Manual Setup Checklist

| Variable | Exposed to browser? | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (public, safe) | client Supabase JS (`src/lib/supabase/client.ts`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes (public, safe — protected by RLS) | client Supabase JS (matches the name already used in the existing `client.ts` scaffold) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No, server-only** | all `/api/*` functions (service-role client, replacing `server.ts`) |
| `ADMIN_PASSWORD` | **No, server-only** | `/api/admin/login` |
| `ADMIN_SESSION_SECRET` | **No, server-only** | signing/verifying the admin session cookie |

Manual setup steps (executed by the user, not automated by this
implementation — no Supabase/Vercel CLI access in this environment):

1. Run the SQL migration (schema + RPC functions + RLS policies + tour seed
   data) against the existing Supabase project.
2. Retrieve the Supabase project URL, anon key, and service-role key from
   the Supabase dashboard.
3. Create/link a Vercel project to this repo (`vercel link` or dashboard
   import).
4. Set all 5 env vars above in Vercel (Production + Preview) and in a
   local `.env.local` for dev.
5. For local dev, use `vercel dev` instead of `vite dev` so the `/api`
   serverless functions run alongside the frontend.
6. Deploy, then run the manual QA checklist (§7) against the real
   deployment.

## 7. Error Handling & Manual QA

**Error handling additions** (on top of the original spec's §6, which
already covers not-found MSNV, tour-full, duplicate registration, and
import row errors):
- Network/Supabase failures show a distinct generic error ("Có lỗi xảy ra,
  vui lòng thử lại") separate from business-rule errors, so users don't
  confuse a dropped connection with an invalid MSNV.
- Any `/api/admin/*` call returning 401 (expired/invalid session) sends the
  admin back to the login form with a "Phiên đăng nhập đã hết hạn" message.

**Manual QA additions** (on top of the original spec's §7 checklist):
- Re-run the full 4-screen + admin flow against the real deployed
  Supabase/Vercel environment (not just local mocks).
- Confirm RLS actually blocks direct anon access to `employees`/
  `registrations` (e.g. a raw REST call with the anon key should fail or
  return nothing).
- Confirm two browser tabs both see a live capacity update via Realtime
  after one submits a registration.
- Confirm admin session cookie expiry forces re-login, and a page refresh
  while logged in does not.

No automated test suite is added, consistent with the prior decision for
this project's short-lived scope.
