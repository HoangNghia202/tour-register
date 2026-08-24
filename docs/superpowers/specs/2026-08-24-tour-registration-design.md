# Design Specification: Tour Registration Website (Trung Bộ 2026)

Date: 2026-08-24
Status: Approved

## 1. Overview

A short-lived (~1 month) internal event website for employees to register for one of two
company-sponsored trips (Đà Lạt or Nha Trang) using their employee ID (MSNV), bring up to
4 companions, choose transport/pickup options, see a live pricing estimate, and download a
digital event ticket. An admin page allows managing the employee list, tour capacity/pricing,
and exporting registrations for logistics.

Business rules are defined in `requirements.md` (Vietnamese source spec) at the repo root.
This document defines the technical design implementing that spec.

## 2. Architecture & Tech Stack

- **Frontend:** React + Vite (SPA), deployed free on **Vercel**.
- **Backend/DB:** **Supabase** (Postgres) free tier. The frontend reads directly via the
  Supabase JS client for public data (tour list, capacity) and subscribes to Supabase
  Realtime for live capacity updates.
- **Privileged operations** — registration submission (atomic capacity check + insert),
  admin Excel import, and admin Excel export — run through **Vercel serverless functions**
  using the Supabase *service role* key. This keeps write permissions and the admin
  password off the public client.
- **Ticket image download:** client-side PNG generation of the ticket DOM node using
  `html-to-image`. No server round-trip required.
- **Excel import/export:** `xlsx` (SheetJS), used both in the admin UI (parsing uploads)
  and in the export serverless function (generating `.xlsx` downloads).
- **Assets:** tour images, PDF itineraries, and ticket brand logos are placeholders for
  now; real assets will be swapped in later (static files, no admin management needed for
  these).

This stack requires no server to operate/maintain, runs entirely on free tiers, and is
easy to tear down after the event window closes.

## 3. Data Model

Postgres tables in Supabase:

### `employees`
| column | type | notes |
|---|---|---|
| `id` | text, PK | the MSNV value |
| `full_name` | text | |
| `department` | text | |
| `store` | text | |
| `destination` | text | `da_lat` \| `nha_trang` |

Managed only via admin Excel import (see §5).

### `tours`
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `destination` | text | `da_lat` \| `nha_trang` |
| `name` | text | e.g. "Nha Trang 2" |
| `start_date` / `end_date` | date | |
| `max_capacity` | int | 750 for Đà Lạt, 450 each for Nha Trang 1–4 |
| `registered_count` | int | atomically incremented on each successful registration |
| `adult_price` | numeric | per-tour adult companion price |
| `child_price` | numeric | per-tour child companion price |
| `pdf_url` | text | itinerary PDF link, opens in a new tab |
| `image_url` | text | placeholder for now |

Seeded once: 1 Đà Lạt row + 4 Nha Trang rows. Admin can edit `max_capacity`,
`adult_price`, `child_price` per row.

### `registrations`
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `employee_id` | FK → `employees.id`, **unique** | enforces one registration per employee |
| `tour_id` | FK → `tours.id` | |
| `transport_method` | text | `self` \| `tour_bus` |
| `pickup_point` | text, nullable | one of 7 provinces, required if `transport_method = tour_bus` |
| `total_price` | numeric | computed at submit time |
| `created_at` | timestamptz | |

### `companions`
| column | type | notes |
|---|---|---|
| `id` | PK | |
| `registration_id` | FK → `registrations.id` | |
| `full_name` | text | |
| `dob` | date | |
| `gender` | text | |
| `relationship` | text | e.g. Vợ/Chồng, Con, Bố/Mẹ |
| `type` | text | `adult` \| `child`, derived from `dob` at insert time (age ≥ 10 → adult) |

Max 2 `child` + 2 `adult` rows per registration, enforced in the submit function.

### Capacity safety

Registration submission runs as a single Postgres function, invoked via the serverless
function, that in one transaction:
1. Checks `registered_count < max_capacity` for the selected tour.
2. Inserts the registration row and its companion rows.
3. Increments `tours.registered_count`.

This prevents overbooking under concurrent submissions. If the check fails, the function
returns an error and no rows are written.

## 4. Screens & Flow

### Screen 1 — Welcome / MSNV entry
- Employee enters their ID. Frontend looks up `employees.id`.
- **Not found:** show the red warning message exactly as specified in `requirements.md`
  §2.1 ("User nhân viên không nằm trong danh sách...").
- **Found:** check `registrations` for an existing row with that `employee_id`.
  - Exists → skip directly to Screen 4, rendering their existing ticket (no re-registration
    allowed).
  - Doesn't exist → proceed to Screen 2.

### Screen 2 — Tour selection
- Query `tours` filtered by the employee's `destination`.
- Đà Lạt → 1 card. Nha Trang → 4 cards, freely selectable by the employee (not
  pre-assigned to a specific departure).
- Each card shows: name, image, dates, live capacity badge (`registered_count/max_capacity`,
  updated via Supabase Realtime subscription), and a PDF itinerary link (opens in a new tab).
- "Đăng ký" button opens Screen 3 for the selected tour.

### Screen 3 — Registration form
- **Companions:** repeatable fields via "+ Thêm người thân", max 2 child (<10y) + 2 adult
  (≥10y). Each companion: full name, DOB (auto-classifies adult/child), gender,
  relationship to employee.
- **Transport:** radio choice `Tự túc theo Tour Công ty` vs `Di chuyển theo Xe Tour`. The
  latter reveals a dropdown of the 7 pickup provinces (required).
- **Pricing calculator:** live-updating total — employee is free (0đ); each adult/child
  companion priced at the selected tour's `adult_price`/`child_price`.
- **Confirmation:** required checkbox gates the submit button. Submit calls the atomic
  registration RPC (§3).

### Screen 4 — Ticket
- Renders the ticket layout per the mock design in `requirements.md` §2.4, populated with
  employee, tour, and registration data.
- "Tải ảnh vé (.png)" button captures the ticket DOM node via `html-to-image` and triggers
  a download.

## 5. Admin Page

- **Access:** `/admin` route, gated by a single shared password checked against an env var
  (`ADMIN_PASSWORD`) via a serverless function that issues a signed session cookie on
  success. No per-user admin accounts.
- **Employee management:** upload an Excel file with columns MSNV (→ `id`), Họ tên, Bộ
  phận, Siêu thị, Điểm đến. Parsed client-side with `xlsx`, sent to a serverless function
  that validates each row (required fields present, `destination` is a valid value, no
  duplicate IDs within the file) and upserts into `employees`. Invalid rows are reported
  back to the admin without blocking the valid rows from importing.
- **Tour config:** an editable table of all 5 tour rows where the admin can update
  `max_capacity`, `adult_price`, and `child_price`.
- **Registrations view/export:** a table listing all registrations joined with employee,
  tour, and companion data, plus an "Export to Excel" button that calls a serverless
  function to generate and download an `.xlsx` (one row per registrant including
  companions) — used for logistics headcounts (transport/food planning).

## 6. Error Handling

- Invalid/not-found MSNV → red banner with the exact spec wording.
- Tour full at submit time → capacity is re-checked atomically server-side; user sees a
  clear "tour is now full, please pick another" message and is returned to Screen 2.
- Duplicate registration attempts → blocked by the unique `employee_id` constraint on
  `registrations`; surfaced as a friendly error (in practice this is also prevented by the
  Screen 1 existing-registration check).
- Excel import → per-row validation errors shown to the admin; valid rows still import.

## 7. Testing

Given the short-lived scope, no automated unit/e2e test suite is planned. Validation is
via a manual QA checklist covering:
- All 4 screens end-to-end for both destinations (Đà Lạt and each Nha Trang departure).
- Companion max-count enforcement (2 child + 2 adult) and age-based classification.
- Transport/pickup conditional field behavior.
- Pricing calculator accuracy per tour's rates.
- Capacity edge cases (tour at/near full, concurrent submission behavior).
- Admin login, Excel import (valid + invalid rows), tour config edits, and Excel export
  content accuracy.
