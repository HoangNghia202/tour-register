# Design Specification: Route-Based Pricing & Schema Updates

Date: 2026-08-28
Status: Approved

## 1. Overview

Amendment to the two prior specs
(`2026-08-24-tour-registration-design.md`,
`2026-08-25-supabase-backend-wiring-design.md`). It captures a set of
business-rule and schema changes requested after the backend went live:

1. `employees.department` is renamed to `store_id`; its UI label changes
   from "Bộ phận" to "Mã siêu thị".
2. Tour price no longer depends on companion type (adult/child). It depends
   on the **pickup route** of the tour's destination. `tours.adult_price`
   and `tours.child_price` are removed; a new `destination_pricing` table
   holds one price per (destination, route).
3. *(No item 3 in the source request.)*
4. Companion cap changes from "2 adults + 2 children" to
   **"4 adults + 2 children"**. The capacity slot-count rule is unchanged
   (employee + number of adult companions).
5. The admin "Cấu hình Tour" screen configures both tour meta
   (`name`, `start_date`, `end_date`, `max_capacity`) and the route prices,
   rendered as a grouped table (tour = group row, routes = sub-rows).
6. Required fields on the registration form get a visible marker.

The live Supabase schema is the **snake_case** variant (matching migrations
`0003`–`0006`; `registrations.id` is `bigint`). `0001_init.sql` (quoted
camelCase, `uuid` id) is not the deployed schema and is left as-is. All new
migrations are written for snake_case.

Pricing rule agreed for this change:

```
ticketCount = 1 (employee) + number of adult companions   -- children excluded
routeKey    = transportMethod === 'self' ? 'self' : pickupPoint
routePrice  = destination_pricing[employee.destination][routeKey].price
totalPrice  = routePrice * ticketCount
```

Children never count toward `ticketCount`, `total_price`, or the capacity
slot count. `classifyAge` (age < 10 → child) is retained; it still drives
adult/child classification for the caps and the ticket-count math.

## 2. Data Model Changes

### `employees` — rename `department` → `store_id`

| column | type | notes |
|---|---|---|
| `id` | text, PK | MSNV |
| `full_name` | text | |
| `store_id` | text | **was `department`** — the store code ("Mã siêu thị") |
| `store` | text | store name ("Siêu thị") — unchanged |
| `destination` | text | `da_lat` \| `nha_trang` — unchanged |

No data transformation: the column's existing values are the store codes
already shown on the ticket as "Mã siêu thị".

### `tours` — drop price columns

Remove `adult_price` and `child_price`. All other columns unchanged
(`id`, `destination`, `name`, `start_date`, `end_date`, `max_capacity`,
`registered_count`, `pdf_url`, `image_url`).

### New table `destination_pricing`

```sql
create table if not exists public.destination_pricing (
  destination  text    not null check (destination in ('da_lat','nha_trang')),
  pickup_point text    not null,
  price        numeric not null default 0,
  primary key (destination, pickup_point)
);
```

- `pickup_point` values: the sentinel `'self'` plus the 7 canonical
  province strings used everywhere else in the app —
  `'Hà Tĩnh'`, `'Quảng Bình'`, `'Quảng Trị'`, `'TP. Huế'`, `'Đà Nẵng'`,
  `'Quảng Nam'`, `'Quảng Ngãi'`. (The price list's "Huế" maps to the
  canonical `'TP. Huế'`.)
- 16 rows total (2 destinations × 8 routes).
- **RLS**: `select` open to `anon`/`authenticated` (the wizard reads it to
  price the form); no write policy, so writes are `service_role` only —
  identical to the `tours` policy.
- Realtime is **not** required on this table (prices change rarely and only
  from the admin screen; the wizard reads once on mount).

### Seed values

| route | da_lat | nha_trang |
|---|---|---|
| `self` | 3 080 000 | 3 200 000 |
| `Hà Tĩnh` | 4 415 000 | 4 420 000 |
| `Quảng Bình` | 4 245 000 | 4 360 000 |
| `Quảng Trị` | 4 220 000 | 4 310 000 |
| `TP. Huế` | 4 160 000 | 4 280 000 |
| `Đà Nẵng` | 4 055 000 | 4 120 000 |
| `Quảng Nam` | 4 045 000 | 4 105 000 |
| `Quảng Ngãi` | 3 995 000 | 4 040 000 |

(`3tr995kk` in the source request is read as 3 995 000.)

### `domain.ts`

- `Employee.department` → `Employee.storeId`.
- Remove `Tour.adultPrice` and `Tour.childPrice`.
- Add `DestinationPricing` type: `{ destination: Destination; pickupPoint: 'self' | PickupPoint; price: number }`.
- Add a helper alias `RouteKey = 'self' | PickupPoint`.

## 3. Business Logic

### `src/lib/pricing.ts`

- Keep `classifyAge`.
- Replace `calculateTotal(companions, tour)` with:

  ```ts
  export function countAdults(companions: Companion[]): number
  export function calculateTotal(routePrice: number, adultCount: number): number
      // routePrice * (1 + adultCount)
  ```

- Add `resolveRouteKey(transportMethod, pickupPoint): RouteKey`
  (`'self'` when `transportMethod === 'self'`, else the `pickupPoint`).

### `submit_registration` RPC — migration `0009`

- **Signature unchanged**:
  `(p_employee_id text, p_tour_id text, p_transport_method text, p_pickup_point text, p_total_price numeric, p_companions jsonb)`.
  The API contract does not change; `p_total_price` is accepted but ignored
  (kept only so the existing call site and its backward-compat fallback in
  `api/register.ts` keep working).
- New body:
  1. Resolve the tour by `id::text = p_tour_id` (as in `0006`), locking the
     row; read its `destination`, `max_capacity`, `registered_count`.
  2. `v_slot_count = 1 + (adult companions)` — unchanged.
  3. **Cap check (new, previously unenforced in SQL):** raise
     `TOO_MANY_ADULTS` if adult companions > 4, `TOO_MANY_CHILDREN` if
     child companions > 2.
  4. Capacity check `registered_count + slot_count > max_capacity` →
     `TOUR_FULL`. Duplicate check → `ALREADY_REGISTERED`.
  5. `v_route_key = case when p_transport_method = 'self' then 'self' else p_pickup_point end`.
  6. `select price into v_route_price from destination_pricing
     where destination = v_destination and pickup_point = v_route_key;`
     If not found → raise `ROUTE_PRICE_NOT_FOUND`.
  7. `v_total_price = v_route_price * v_slot_count`.
  8. Insert `registrations` + `companions`, bump `tours.registered_count`
     by `v_slot_count`, return the same JSON shape as `0006` plus
     `total_price` = `v_total_price`.
- `drop function if exists` the old `(text,text,text,text,numeric,jsonb)`
  and `(text,bigint,text,text,numeric,jsonb)` overloads first, per the
  `0006` pattern, then recreate.

### `api/register.ts`

- Companion validation: `normalizedCompanions.length > 4` → `> 6`.
- Remove the `adult_price` / `child_price` read and the client-side
  `totalPrice` reduce. Send `p_total_price: 0` and use the `total_price`
  value the RPC returns (step 7 above) as the authoritative number in the
  response body. Do not recompute price in the API layer.
- Error map: add Vietnamese messages for `TOO_MANY_ADULTS`
  ("Tối đa 4 người lớn đi kèm."), `TOO_MANY_CHILDREN`
  ("Tối đa 2 trẻ em đi kèm."), `ROUTE_PRICE_NOT_FOUND`
  ("Chưa có cấu hình giá cho lộ trình này, vui lòng liên hệ quản trị.").

### `src/lib/api.ts`

- `mapEmployee`: `department`/`store_id` → `storeId` (read both keys
  defensively, like the other mappers).
- `mapTour`: drop `adultPrice` / `childPrice`.
- New `getDestinationPricing(destination: Destination): Promise<Record<RouteKey, number>>`
  — `supabase.from('destination_pricing').select('*').eq('destination', destination)`,
  reduced to a `{ [pickup_point]: price }` map.
- `getAllDestinationPricing()` for the admin screen (all 16 rows).
- New `updateDestinationPrice(destination, pickupPoint, price)` →
  `POST /api/admin/tour-config` (see §4).
- `updateTourConfig` gains `name` / `startDate` / `endDate` alongside
  `maxCapacity` (see §4).

## 4. Admin "Cấu hình Tour" Screen

`AdminLayout` and its tabs are unchanged. `TourConfigTable` is rewritten as
a **grouped table**.

- **Group row — one per tour (5 total).** Editable inline: `name`,
  `start_date`, `end_date` (date inputs), `max_capacity` (number).
  `registered_count` shown read-only. A "Lưu" button on the group row
  saves the tour-meta patch.
- **Sub-rows — the 8 routes** (`Tự túc` label for `self`, then the 7
  provinces), each with an editable `price` number input and its own
  "Lưu".
  - Prices live in `destination_pricing`, keyed by destination. The 4 Nha
    Trang tours therefore render the **same 8 price sub-rows**; saving a
    price under any Nha Trang group writes the one shared row and the
    other three groups reflect it after reload. Nha Trang groups show the
    note: *"Giá áp dụng chung cho tất cả tour Nha Trang."* Đà Lạt has its
    own 8 rows.
- Data load: `getAllTours()` + `getAllDestinationPricing()`.
- Header copy updated from "Chỉnh sức chứa và giá vé cho từng tour…" to
  reflect meta + route prices.

### API — `api/admin/tour-config.ts`

Extend the existing `POST` handler (still `requireAdminSession`-gated) to
accept one of two payload shapes, discriminated by their keys:

- **Tour meta patch**:
  `{ tourId: string, changes: { name?, startDate?, endDate?, maxCapacity? } }`
  → update `tours` (`start_date`/`end_date`/`max_capacity` snake_case).
  `maxCapacity` keeps the existing `>= 0` finite guard; dates validated as
  parseable `YYYY-MM-DD`; `name` trimmed non-empty.
- **Route price patch**:
  `{ destination: 'da_lat'|'nha_trang', pickupPoint: RouteKey, price: number }`
  → `upsert` into `destination_pricing` on `(destination, pickup_point)`.
  `price` must be finite and `>= 0`.

The `adult_price` / `child_price` branch is removed. `normalizeTourId`
handling is retained for the tour-meta branch.

## 5. Other Frontend Changes

### `src/components/ui/label.tsx`

Add an optional `required?: boolean` prop. When set, render the children
followed by `<span aria-hidden className="ml-0.5 text-destructive">*</span>`
and apply `font-medium`. `aria-required` is left to the input; the marker
is purely visual, matching the request ("highlight … cho dễ nhìn").

### `src/components/wizard/RegistrationFormScreen.tsx`

- Fetch `getDestinationPricing(employee.destination)` on mount; hold it in
  state. Show the form's existing loading affordance until it resolves;
  on failure show the standard error alert.
- `watch` `transportMethod` + `pickupPoint`; derive
  `routeKey = resolveRouteKey(...)` and `routePrice = pricing[routeKey]`.
  When `transportMethod === 'tour_bus'` and no `pickupPoint` chosen yet,
  `routePrice` is undefined and the summary shows a "Chọn điểm đón để xem
  giá" placeholder.
- `companions` cap: `.array(companionSchema).max(6)`; superRefine adult
  branch trips at `adultCount > 4` with message
  "Đã đủ số lượng người lớn tối đa (4)"; child branch unchanged (`> 2`).
- Pass `routePrice`, `transportMethod`, `pickupPoint` (and the derived
  `adultCount` or the companion list) to `PricingSummary`.
- Add a "* Trường bắt buộc" legend near the form heading.
- Mark the confirmation checkbox `Label` `required`.

### `src/components/wizard/CompanionFieldArray.tsx`

- Helper text → "Tối đa 4 người lớn (từ 10 tuổi) và 2 trẻ em (dưới 10
  tuổi)."
- `overCapIndices`: adult branch trips at `adultCount > 4`.
- `capsReached = fields.length >= 6 || (childCount >= 2 && adultCount >= 4)`.
- Over-cap message for adults → "Đã đủ số lượng người lớn tối đa (4)".
- All four field `Label`s (`Họ và tên`, `Ngày sinh`, `Giới tính`,
  `Mối quan hệ`) get `required`.

### `src/components/wizard/TransportSection.tsx`

- The "Điểm đón" `Label` gets `required` (it is required whenever
  `tour_bus` is selected).
- No behavioural change to the pickup list.

### `src/components/wizard/PricingSummary.tsx`

New props: `{ routePrice: number | undefined, transportMethod, pickupPoint, adultCount }`.
Layout:

| Row | Value |
|---|---|
| Lộ trình đón | `Tự túc` or the province name |
| Đơn giá / vé | `routePrice` VNĐ (or "—" when not yet chosen) |
| Số vé (nhân viên + người lớn) | `1 + adultCount` |
| **TỔNG TIỀN DỰ KIẾN** | `routePrice × (1 + adultCount)` VNĐ (or "—") |

When any child companion is present, a muted line: "Trẻ em: không tính
phí". No per-companion rows.

### `src/components/ticket/EventTicket.tsx`

- `infoRows`: "Mã số Nhân viên" unchanged; the "Mã siêu thị" row now reads
  `employee.storeId` (was `employee.department`).

### `src/components/admin/EmployeeImportPanel.tsx`

- `toEmployeeRow`: read the sheet column `'Mã siêu thị'` (was `'Bộ phận'`)
  into `storeId`.
- `Omit<Employee, never>` payloads now carry `storeId`; `api.ts`
  `importEmployees` and `api/admin/import-employees.ts` map it to
  `store_id`.

### `api/admin/import-employees.ts` and `api/admin/registrations.ts`

- `import-employees.ts`: validate/insert `store_id` instead of
  `department`.
- `registrations.ts` / `export-registrations.ts`: `normalizeEmployee`
  reads `store_id` → `storeId`; `normalizeTour` drops `adult_price` /
  `child_price`. The registrations table / export otherwise unchanged
  (they already show `total_price`, `Tổng số vé = 1 + adults`).

## 6. Migrations

New files, snake_case, idempotent where possible, applied **in order** in
the Supabase SQL editor:

| file | contents |
|---|---|
| `0007_rename_employee_department_to_store_id.sql` | `alter table public.employees rename column department to store_id;` guarded by an `information_schema.columns` existence check so re-running is safe. |
| `0008_add_destination_pricing_table.sql` | create `destination_pricing`; enable RLS; `select` policy for `anon`/`authenticated`; insert the 16 seed rows `on conflict do nothing`. |
| `0009_submit_registration_route_pricing.sql` | `drop function if exists` the two old `submit_registration` overloads; recreate per §3. Must run **after** `0008` (it reads `destination_pricing`) and **before** `0010` (so the recreated function, which no longer references `adult_price`/`child_price`, is in place before those columns are dropped). |
| `0010_drop_tour_price_columns.sql` | `alter table public.tours drop column if exists adult_price, drop column if exists child_price;` Run **last**. |

Ordering constraints: `0007` any time; `0008` before `0009`; `0009` before
`0010`. The file numbers above encode that order.

## 7. Out of Scope

- No change to the welcome/MSNV screen, tour-selection screen, admin login,
  or the existing-registration replay path.
- No Realtime subscription on `destination_pricing`.
- No automated test suite (consistent with both prior specs); validation is
  the manual QA checklist below.
- `0001_init.sql` is not rewritten.

## 8. Manual QA Checklist

- Excel import with a `Mã siêu thị` column populates `employees.store_id`;
  invalid rows still reported per-row.
- Ticket screen shows the store code in the "Mã siêu thị" row.
- Registration form: total updates immediately when transport method or
  pickup point changes.
- Total equals `routePrice × (1 + adultCount)` for 0–4 adult and 0–2 child
  companions, on both `da_lat` and `nha_trang`, for `self` and for each of
  the 7 provinces (spot-check 2–3).
- Caps: the 5th adult, the 3rd child, and the 7th companion are all
  blocked in the UI and rejected by `submit_registration`.
- Required `*` markers render on all companion fields, the pickup point
  (when `tour_bus`), and the confirmation checkbox; "* Trường bắt buộc"
  legend present.
- Admin: editing a tour's `name`/`start_date`/`end_date`/`max_capacity`
  saves and reloads correctly.
- Admin: editing a route price saves; the wizard for that destination
  reflects the new price; editing under one Nha Trang tour changes the
  price seen under the other three.
- `ROUTE_PRICE_NOT_FOUND` path: delete a `destination_pricing` row and
  confirm the user sees the friendly Vietnamese message rather than a raw
  error.
- Capacity math still consumes `1 + adultCount` slots (children free).
