# Route-Based Pricing & Schema Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch tour pricing from per-companion-type to per-pickup-route, rename `employees.department` to `store_id`, raise the companion cap to 4 adults + 2 children, rebuild the admin tour-config screen as a grouped table, and mark required fields on the registration form.

**Architecture:** The live Supabase schema is snake_case (`registrations.id` is `bigint`). Four ordered SQL migrations (`0007`–`0010`) rename the employee column, add a `destination_pricing` table keyed by `(destination, pickup_point)`, rewrite the `submit_registration` function to price from that table, and drop the old `tours` price columns. The frontend reads `destination_pricing` directly via the anon Supabase client (public-read RLS, same pattern as `tours`); all writes stay behind the service-role `/api/admin/*` routes. Pricing rule: `totalPrice = routePrice × (1 + adultCount)`, children never priced or counted.

**Tech Stack:** React 19 + Vite, react-hook-form + zod, Tailwind + shadcn/ui, Supabase (Postgres, snake_case schema), Vercel serverless functions (`api/`, ESM, `.js` import extensions), oxlint, TypeScript project references (`tsconfig.app.json` / `tsconfig.api.json`).

**Spec:** `docs/superpowers/specs/2026-08-28-tour-pricing-and-schema-updates-design.md` — read it alongside this plan.

## Global Constraints

- **No automated test suite.** Both prior specs and the current one explicitly reject one. Per-task verification is: `npx tsc -b` (typechecks all three TS projects) passes, `npm run lint` (oxlint) is clean, plus the concrete manual check named in the task. The final task runs a full `npm run build`.
- **All user-facing copy is Vietnamese.** Keep new strings Vietnamese and match the surrounding tone.
- **Deployed DB schema is snake_case.** Write SQL and Supabase queries in snake_case (`store_id`, `start_date`, `max_capacity`, `pickup_point`, …). `supabase/migrations/0001_init.sql` (camelCase) is NOT the deployed schema — do not touch it.
- **`api/` relative imports use explicit `.js` extensions** even for `.ts` files (Vercel ESM runtime). Preserve this.
- **Canonical pickup-point strings** (used verbatim everywhere — DB seed, form, RPC, admin): `Hà Tĩnh`, `Quảng Bình`, `Quảng Trị`, `TP. Huế`, `Đà Nẵng`, `Quảng Nam`, `Quảng Ngãi`. The self / "tự túc" option is the sentinel route key `self`.
- **Route key resolution:** `transportMethod === 'self'` → `'self'`; otherwise the chosen `pickupPoint` string.
- **Companion caps:** ≤ 4 adults, ≤ 2 children, ≤ 6 companions total. Capacity slot count is unchanged: `1 + adultCount` (children consume no slot).
- **Migrations are applied manually** by the repo owner in the Supabase SQL editor, in filename order. This plan only creates the `.sql` files.
- **Commit after every task** with the message shown in its final step.

---

## File Structure

**Created:**
- `supabase/migrations/0007_rename_employee_department_to_store_id.sql` — column rename, idempotent.
- `supabase/migrations/0008_add_destination_pricing_table.sql` — table + RLS + 16 seed rows.
- `supabase/migrations/0009_submit_registration_route_pricing.sql` — recreate `submit_registration`.
- `supabase/migrations/0010_drop_tour_price_columns.sql` — drop `adult_price` / `child_price`.

**Modified:**
- `src/types/domain.ts` — `storeId`, remove tour prices, add `RouteKey` / `DestinationPricing`.
- `src/lib/pricing.ts` — new `calculateTotal` / `countAdults` / `resolveRouteKey`.
- `src/lib/api.ts` — employee mapper, tour mapper, pricing fetch/update fns, `updateTourConfig` meta fields.
- `src/components/ui/label.tsx` — `required` prop → red `*`.
- `api/register.ts` — cap `> 6`, drop price read, `p_total_price: 0`, new error messages.
- `api/admin/tour-config.ts` — tour-meta patch OR route-price patch.
- `api/admin/import-employees.ts` — `store_id` instead of `department`.
- `api/admin/registrations.ts`, `api/admin/export-registrations.ts` — `storeId`, drop tour prices from normalizers.
- `src/components/wizard/RegistrationFormScreen.tsx` — caps, required legend/checkbox, pricing wiring.
- `src/components/wizard/CompanionFieldArray.tsx` — caps 4+2, required labels, helper text.
- `src/components/wizard/TransportSection.tsx` — required pickup label.
- `src/components/wizard/PricingSummary.tsx` — full rewrite to route pricing.
- `src/components/ticket/EventTicket.tsx` — `employee.storeId`.
- `src/components/admin/EmployeeImportPanel.tsx` — `Mã siêu thị` sheet column → `storeId`.
- `src/components/admin/TourConfigTable.tsx` — full rewrite as a grouped table.
- `requirements.md` — price rule, companion cap, employee columns.

---

## Task 1: SQL migrations

**Files:**
- Create: `supabase/migrations/0007_rename_employee_department_to_store_id.sql`
- Create: `supabase/migrations/0008_add_destination_pricing_table.sql`
- Create: `supabase/migrations/0009_submit_registration_route_pricing.sql`
- Create: `supabase/migrations/0010_drop_tour_price_columns.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: DB contract the rest of the plan targets — `employees.store_id text`; `destination_pricing(destination text, pickup_point text, price numeric, pk (destination, pickup_point))` with public-read RLS; `submit_registration(p_employee_id text, p_tour_id text, p_transport_method text, p_pickup_point text, p_total_price numeric, p_companions jsonb) returns jsonb` where the returned JSON has keys `success`, `registration_id`, `total_price`, `slot_count`, `tour_id`; `tours` no longer has `adult_price` / `child_price`.

- [ ] **Step 1: Create `0007_rename_employee_department_to_store_id.sql`**

```sql
-- Rename employees.department -> store_id ("Mã siêu thị", the store code).
-- Idempotent: only renames when the old column still exists and the new one does not.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'department'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'store_id'
  ) then
    alter table public.employees rename column department to store_id;
  end if;
end;
$$;
```

- [ ] **Step 2: Create `0008_add_destination_pricing_table.sql`**

```sql
-- Route-based pricing: one price per (destination, route).
-- route = 'self' (tự túc) or one of the 7 canonical pickup-point strings.
create table if not exists public.destination_pricing (
  destination  text    not null check (destination in ('da_lat','nha_trang')),
  pickup_point text    not null,
  price        numeric not null default 0,
  primary key (destination, pickup_point)
);

alter table public.destination_pricing enable row level security;

drop policy if exists "destination_pricing_public_read" on public.destination_pricing;
create policy "destination_pricing_public_read" on public.destination_pricing
  for select
  to anon, authenticated
  using (true);

insert into public.destination_pricing (destination, pickup_point, price) values
  ('da_lat',    'self',        3080000),
  ('da_lat',    'Hà Tĩnh',     4415000),
  ('da_lat',    'Quảng Bình',  4245000),
  ('da_lat',    'Quảng Trị',   4220000),
  ('da_lat',    'TP. Huế',     4160000),
  ('da_lat',    'Đà Nẵng',     4055000),
  ('da_lat',    'Quảng Nam',   4045000),
  ('da_lat',    'Quảng Ngãi',  3995000),
  ('nha_trang', 'self',        3200000),
  ('nha_trang', 'Hà Tĩnh',     4420000),
  ('nha_trang', 'Quảng Bình',  4360000),
  ('nha_trang', 'Quảng Trị',   4310000),
  ('nha_trang', 'TP. Huế',     4280000),
  ('nha_trang', 'Đà Nẵng',     4120000),
  ('nha_trang', 'Quảng Nam',   4105000),
  ('nha_trang', 'Quảng Ngãi',  4040000)
on conflict (destination, pickup_point) do nothing;
```

- [ ] **Step 3: Create `0009_submit_registration_route_pricing.sql`**

```sql
-- submit_registration: price now comes from destination_pricing keyed by
-- (tour.destination, route), where route = 'self' or the pickup point.
-- total_price = route price * (1 + number of adult companions).
-- Enforces companion caps: <= 4 adults, <= 2 children.
-- p_total_price is accepted for signature stability but ignored (server is authoritative).

drop function if exists public.submit_registration(text, bigint, text, text, numeric, jsonb);
drop function if exists public.submit_registration(text, text, text, text, numeric, jsonb);

create or replace function public.submit_registration(
  p_employee_id text,
  p_tour_id text,
  p_transport_method text,
  p_pickup_point text,
  p_total_price numeric,
  p_companions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tour_id public.tours.id%type;
  v_destination text;
  v_max_capacity int;
  v_registered_count int;
  v_registration_id bigint;
  v_adult_count int := 0;
  v_child_count int := 0;
  v_slot_count int := 1;
  v_route_key text;
  v_route_price numeric;
  v_total_price numeric := 0;
begin
  select
    coalesce(sum(case when item ->> 'type' = 'adult' then 1 else 0 end), 0),
    coalesce(sum(case when item ->> 'type' = 'child' then 1 else 0 end), 0)
  into v_adult_count, v_child_count
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) as item;

  if v_adult_count > 4 then
    raise exception 'TOO_MANY_ADULTS';
  end if;
  if v_child_count > 2 then
    raise exception 'TOO_MANY_CHILDREN';
  end if;

  v_slot_count := 1 + v_adult_count;

  select id, destination, max_capacity, registered_count
  into v_tour_id, v_destination, v_max_capacity, v_registered_count
  from public.tours
  where id::text = p_tour_id
  for update;

  if not found then
    raise exception 'TOUR_NOT_FOUND';
  end if;

  if exists (select 1 from public.registrations where employee_id = p_employee_id) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  if v_registered_count + v_slot_count > v_max_capacity then
    raise exception 'TOUR_FULL';
  end if;

  v_route_key := case when p_transport_method = 'self' then 'self' else p_pickup_point end;

  select price into v_route_price
  from public.destination_pricing
  where destination = v_destination and pickup_point = v_route_key;

  if not found then
    raise exception 'ROUTE_PRICE_NOT_FOUND';
  end if;

  v_total_price := v_route_price * v_slot_count;

  insert into public.registrations (employee_id, tour_id, transport_method, pickup_point, total_price)
  values (p_employee_id, v_tour_id, p_transport_method, p_pickup_point, v_total_price)
  returning id into v_registration_id;

  insert into public.companions (registration_id, full_name, dob, gender, relationship, type)
  select
    v_registration_id,
    coalesce(c ->> 'full_name', c ->> 'fullName'),
    (c ->> 'dob')::date,
    c ->> 'gender',
    c ->> 'relationship',
    c ->> 'type'
  from jsonb_array_elements(coalesce(p_companions, '[]'::jsonb)) as c;

  update public.tours
  set registered_count = registered_count + v_slot_count
  where id = v_tour_id;

  return jsonb_build_object(
    'success', true,
    'registration_id', v_registration_id,
    'total_price', v_total_price,
    'slot_count', v_slot_count,
    'tour_id', v_tour_id
  );
end;
$$;
```

- [ ] **Step 4: Create `0010_drop_tour_price_columns.sql`**

```sql
-- Tour price no longer depends on companion type; pricing moved to destination_pricing.
alter table public.tours drop column if exists adult_price;
alter table public.tours drop column if exists child_price;
```

- [ ] **Step 5: Verify SQL by reading it back**

Run: `ls supabase/migrations/000[7-9]* supabase/migrations/0010*`
Expected: all four files listed.
Re-read each file. Confirm: `0008` seed has exactly 16 rows (8 per destination); every `pickup_point` is one of `self` + the 7 canonical strings; `0009` drops both old overloads before `create or replace`; `0009` reads `destination` from `tours`; return JSON key is `total_price`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_rename_employee_department_to_store_id.sql \
        supabase/migrations/0008_add_destination_pricing_table.sql \
        supabase/migrations/0009_submit_registration_route_pricing.sql \
        supabase/migrations/0010_drop_tour_price_columns.sql
git commit -m "feat(db): route-based pricing migrations + employee store_id rename"
```

- [ ] **Step 7: Apply the migrations**

Tell the repo owner to run `0007` → `0008` → `0009` → `0010` in order in the Supabase SQL editor before the rest of the plan is exercised end-to-end (the frontend/API tasks typecheck without the DB, but manual verification needs it). Ordering: `0008` before `0009` (the function reads `destination_pricing`); `0009` before `0010`.

---

## Task 2: Domain types & pricing helpers

**Files:**
- Modify: `src/types/domain.ts`
- Modify: `src/lib/pricing.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Employee.storeId: string` (was `department`).
  - `Tour` without `adultPrice` / `childPrice`.
  - `type RouteKey = 'self' | PickupPoint`.
  - `interface DestinationPricing { destination: Destination; pickupPoint: RouteKey; price: number }`.
  - `classifyAge(dob: string): 'adult' | 'child'` — unchanged.
  - `countAdults(companions: Companion[]): number`.
  - `resolveRouteKey(transportMethod: TransportMethod, pickupPoint: PickupPoint | null): RouteKey | null`.
  - `calculateTotal(routePrice: number, adultCount: number): number` — `routePrice * (1 + adultCount)`.

- [ ] **Step 1: Edit `src/types/domain.ts`**

In `interface Employee`, replace the `department` line with:

```ts
  storeId: string;
```

In `interface Tour`, delete these two lines:

```ts
  adultPrice: number;
  childPrice: number;
```

After the `PickupPoint` type, add:

```ts
export type RouteKey = "self" | PickupPoint;
```

At the end of the file, add:

```ts
export interface DestinationPricing {
  destination: Destination;
  pickupPoint: RouteKey;
  price: number;
}
```

- [ ] **Step 2: Rewrite `src/lib/pricing.ts`**

Replace the entire file with:

```ts
import type { Companion, PickupPoint, RouteKey, TransportMethod } from "@/types/domain";

export function classifyAge(dob: string): "adult" | "child" {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age < 10 ? "child" : "adult";
}

export function countAdults(companions: Companion[]): number {
  return companions.filter((companion) => companion.type === "adult").length;
}

export function resolveRouteKey(
  transportMethod: TransportMethod,
  pickupPoint: PickupPoint | null,
): RouteKey | null {
  if (transportMethod === "self") return "self";
  return pickupPoint;
}

// Employee + each adult companion pays the route price; children are free.
export function calculateTotal(routePrice: number, adultCount: number): number {
  return routePrice * (1 + adultCount);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: fails — `src/lib/api.ts`, `PricingSummary.tsx`, `RegistrationFormScreen.tsx`, `EventTicket.tsx` etc. still reference `department` / `adultPrice` / `childPrice` / the old `calculateTotal` signature. This is expected; those are fixed in later tasks. Confirm the ONLY errors are those downstream references and none are inside `domain.ts` or `pricing.ts` themselves.

- [ ] **Step 4: Commit**

```bash
git add src/types/domain.ts src/lib/pricing.ts
git commit -m "feat: route-pricing domain types and pricing helpers"
```

---

## Task 3: Data-access layer (`src/lib/api.ts`)

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `Employee.storeId`, `Tour` (no prices), `RouteKey`, `DestinationPricing`, `Destination` from Task 2.
- Produces:
  - `getDestinationPricing(destination: Destination): Promise<Record<string, number>>` — map of `pickup_point` → `price` for one destination.
  - `getAllDestinationPricing(): Promise<DestinationPricing[]>` — all 16 rows.
  - `updateDestinationPrice(destination: Destination, pickupPoint: string, price: number): Promise<void>` — `POST /api/admin/tour-config`.
  - `updateTourConfig(tourId: string, changes: Partial<Pick<Tour, "name" | "startDate" | "endDate" | "maxCapacity">>): Promise<void>` — signature widened.
  - `mapEmployee` now emits `storeId`; `mapTour` no longer emits `adultPrice` / `childPrice`.

- [ ] **Step 1: Update `mapEmployee`**

In `src/lib/api.ts`, replace the `department` line inside `mapEmployee` with:

```ts
    storeId: String(getValue(raw, "storeId", "store_id") ?? ""),
```

- [ ] **Step 2: Update `mapTour`**

Delete these two lines inside `mapTour`:

```ts
    adultPrice: Number(getValue(raw, "adultPrice", "adult_price") ?? 0),
    childPrice: Number(getValue(raw, "childPrice", "child_price") ?? 0),
```

- [ ] **Step 3: Add the `DestinationPricing` import**

Update the type import at the top of the file to include the new types:

```ts
import type {
  Companion,
  Destination,
  DestinationPricing,
  Employee,
  Registration,
  Tour,
} from "@/types/domain";
```

- [ ] **Step 4: Add pricing read functions**

After `getAllTours`, add:

```ts
export async function getDestinationPricing(
  destination: Destination,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("destination_pricing")
    .select("*")
    .eq("destination", destination);
  if (error) throw new Error(error.message);

  const map: Record<string, number> = {};
  for (const row of (data as RawRecord[] | null) ?? []) {
    const key = String(getValue(row, "pickupPoint", "pickup_point") ?? "");
    if (key) map[key] = Number(getValue(row, "price", "price") ?? 0);
  }
  return map;
}

export async function getAllDestinationPricing(): Promise<DestinationPricing[]> {
  const { data, error } = await supabase.from("destination_pricing").select("*");
  if (error) throw new Error(error.message);

  return ((data as RawRecord[] | null) ?? []).map((row) => ({
    destination: mapDestination(getValue(row, "destination", "destination")),
    pickupPoint: String(
      getValue(row, "pickupPoint", "pickup_point") ?? "",
    ) as DestinationPricing["pickupPoint"],
    price: Number(getValue(row, "price", "price") ?? 0),
  }));
}
```

- [ ] **Step 5: Replace `updateTourConfig` and add `updateDestinationPrice`**

Replace the existing `updateTourConfig` function with:

```ts
export async function updateTourConfig(
  tourId: string,
  changes: Partial<Pick<Tour, "name" | "startDate" | "endDate" | "maxCapacity">>,
): Promise<void> {
  const response = await fetch("/api/admin/tour-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tourId, changes }),
  });
  await parseJsonResponse(response);
}

export async function updateDestinationPrice(
  destination: Destination,
  pickupPoint: string,
  price: number,
): Promise<void> {
  const response = await fetch("/api/admin/tour-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ destination, pickupPoint, price }),
  });
  await parseJsonResponse(response);
}
```

- [ ] **Step 6: Fix the `submitRegistration` companion mapper if it references prices**

Confirm `submitRegistration` and `mapRegistration` do not reference `adultPrice` / `childPrice` (they don't today). No change needed — just verify while you're in the file.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: `src/lib/api.ts` now has no errors. Remaining errors are only in `PricingSummary.tsx` / `RegistrationFormScreen.tsx` / `EventTicket.tsx` / `TourConfigTable.tsx` / `EmployeeImportPanel.tsx` (later tasks).

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: clean (or unchanged from baseline).

- [ ] **Step 9: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: destination_pricing data access + widen updateTourConfig"
```

---

## Task 4: `Label` `required` prop

**Files:**
- Modify: `src/components/ui/label.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<Label>` accepts an optional `required?: boolean`. When true it renders the children followed by a red `*` (`aria-hidden`) and adds no layout shift. Existing usages without the prop are unchanged.

- [ ] **Step 1: Edit `src/components/ui/label.tsx`**

Replace the `Label` definition with:

```tsx
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), required && "font-semibold text-foreground", className)}
    {...props}
  >
    {children}
    {required ? (
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
    ) : null}
  </LabelPrimitive.Root>
))
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no new errors introduced by `label.tsx`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/label.tsx
git commit -m "feat(ui): Label required prop renders a red asterisk"
```

---

## Task 5: Registration API (`api/register.ts`)

**Files:**
- Modify: `api/register.ts`

**Interfaces:**
- Consumes: `submit_registration` RPC from Task 1 (returns JSON with `total_price`, `registration_id`).
- Produces: unchanged response shape — `{ ok: true, registration: {...} }` / `{ ok: false, error }`. `registration.totalPrice` now comes from the RPC's `total_price`.

- [ ] **Step 1: Raise the companion cap**

In `api/register.ts`, change:

```ts
  if (
    normalizedCompanions.length > 4 ||
    !normalizedCompanions.every((item) => isValidCompanion(item))
  ) {
```

to:

```ts
  if (
    normalizedCompanions.length > 6 ||
    !normalizedCompanions.every((item) => isValidCompanion(item))
  ) {
```

- [ ] **Step 2: Add new error messages**

In the `ERROR_MESSAGES` map add:

```ts
  TOO_MANY_ADULTS: "Tối đa 4 người lớn đi kèm.",
  TOO_MANY_CHILDREN: "Tối đa 2 trẻ em đi kèm.",
  ROUTE_PRICE_NOT_FOUND:
    "Chưa có cấu hình giá cho lộ trình này, vui lòng liên hệ quản trị.",
```

- [ ] **Step 3: Drop the client-side price computation**

Find the block that reads the tour row and computes `totalPrice`:

```ts
    const adultPrice = getNumber(tourData as Record<string, unknown>, "adult_price", "adultPrice");
    const childPrice = getNumber(tourData as Record<string, unknown>, "child_price", "childPrice");

    const totalPrice = normalizedCompanions.reduce((sum, companion) => {
      return sum + (companion.type === "adult" ? adultPrice : childPrice);
    }, 0);
```

Replace those lines with nothing (delete them). Keep the `tourData` existence check above them (the `if (tourError || !tourData) { ... }` guard stays). Then delete the now-unused `getNumber` helper function.

- [ ] **Step 4: Send `p_total_price: 0` and read the RPC total**

In `rpcPayload`, change `p_total_price: totalPrice` to:

```ts
      p_total_price: 0,
```

In the backward-compat fallback `rpc` call (the one without `p_total_price`), leave it as-is.

After the `if (error) { ... }` block, where `registration` is built, change:

```ts
    const rpcRegistration = (data ?? {}) as RpcRegistrationLike;
```

Add a line right after it:

```ts
    const rpcTotalPrice = Number(
      (data as Record<string, unknown> | null)?.total_price ?? 0,
    );
```

Then in the `registration` object literal change `totalPrice,` to:

```ts
      totalPrice: rpcTotalPrice,
```

Add `total_price` to the `RpcRegistrationLike` interface for clarity:

```ts
interface RpcRegistrationLike {
  id?: unknown;
  registration_id?: unknown;
  registrationId?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  total_price?: unknown;
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: `api/register.ts` clean. No reference to `totalPrice` as a local `const` remains; no unused `getNumber`.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add api/register.ts
git commit -m "feat(api): register uses RPC route pricing, cap raised to 6 companions"
```

---

## Task 6: Admin API routes

**Files:**
- Modify: `api/admin/tour-config.ts`
- Modify: `api/admin/import-employees.ts`
- Modify: `api/admin/registrations.ts`
- Modify: `api/admin/export-registrations.ts`

**Interfaces:**
- Consumes: `destination_pricing` table (Task 1), `updateTourConfig` / `updateDestinationPrice` request bodies (Task 3).
- Produces:
  - `POST /api/admin/tour-config` accepts EITHER `{ tourId, changes: { name?, startDate?, endDate?, maxCapacity? } }` OR `{ destination, pickupPoint, price }`. Returns `{ ok: true }` / `{ ok: false, error }`.
  - `POST /api/admin/import-employees` maps sheet rows' `storeId` → `store_id`.
  - Admin registrations/export normalizers emit `storeId` and no tour prices.

- [ ] **Step 1: Rewrite the `api/admin/tour-config.ts` handler body**

Keep the imports and `normalizeTourId` helper. Replace the `handler` function with:

```ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!requireAdminSession(req, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;

  // --- Route price patch: { destination, pickupPoint, price } ---
  if (typeof body.destination === "string" && typeof body.pickupPoint === "string") {
    const destination = body.destination;
    const pickupPoint = body.pickupPoint;
    const price = Number(body.price);

    if (destination !== "da_lat" && destination !== "nha_trang") {
      return res.status(400).json({ ok: false, error: "Điểm đến không hợp lệ." });
    }
    if (!pickupPoint.trim() || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ ok: false, error: "Giá trị không hợp lệ." });
    }

    const { error } = await supabaseAdmin
      .from("destination_pricing")
      .upsert(
        { destination, pickup_point: pickupPoint, price },
        { onConflict: "destination,pickup_point" },
      );

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  // --- Tour meta patch: { tourId, changes: { name?, startDate?, endDate?, maxCapacity? } } ---
  const { tourId, changes } = body as {
    tourId?: unknown;
    changes?: Record<string, unknown>;
  };

  if (typeof tourId !== "string" || !tourId.trim() || !changes || typeof changes !== "object") {
    return res.status(400).json({ ok: false, error: "Dữ liệu không hợp lệ." });
  }

  const update: Record<string, unknown> = {};

  if (changes.name !== undefined) {
    const name = String(changes.name).trim();
    if (!name) return res.status(400).json({ ok: false, error: "Tên tour không hợp lệ." });
    update.name = name;
  }
  if (changes.startDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(changes.startDate))) {
      return res.status(400).json({ ok: false, error: "Ngày bắt đầu không hợp lệ." });
    }
    update.start_date = changes.startDate;
  }
  if (changes.endDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(changes.endDate))) {
      return res.status(400).json({ ok: false, error: "Ngày kết thúc không hợp lệ." });
    }
    update.end_date = changes.endDate;
  }
  if (changes.maxCapacity !== undefined) {
    const maxCapacity = Number(changes.maxCapacity);
    if (!Number.isFinite(maxCapacity) || maxCapacity < 0) {
      return res.status(400).json({ ok: false, error: "Sức chứa không hợp lệ." });
    }
    update.max_capacity = maxCapacity;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ ok: false, error: "Không có thay đổi nào." });
  }

  const { error } = await supabaseAdmin
    .from("tours")
    .update(update)
    .eq("id", normalizeTourId(tourId));

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Update `api/admin/import-employees.ts`**

Change the `EmployeeRowInput` interface field `department?: unknown;` to `storeId?: unknown;`.

In the `validRows` array type, change `department: string;` to `storeId: string;`.

In the `rows.forEach` body, change:

```ts
    const department = String(row.department ?? "").trim();
```

to:

```ts
    const storeId = String(row.storeId ?? "").trim();
```

Change the guard and its message:

```ts
    if (!id || !fullName || !storeId || !store) {
      errors.push({
        row: rowNumber,
        message: "Thiếu thông tin bắt buộc (MSNV/Họ tên/Mã siêu thị/Siêu thị).",
      });
      return;
    }
```

Change the push:

```ts
    validRows.push({ id, fullName, storeId, store, destination });
```

Change the upsert payload mapping — replace the `supabaseAdmin.from("employees").upsert(validRows, ...)` call with:

```ts
    const { error } = await supabaseAdmin.from("employees").upsert(
      validRows.map((row) => ({
        id: row.id,
        full_name: row.fullName,
        store_id: row.storeId,
        store: row.store,
        destination: row.destination,
      })),
      { onConflict: "id" },
    );
```

> Note: check whether the pre-existing code relied on the column being named `fullName` vs `full_name`. The live schema is snake_case, so `full_name` / `store_id` are correct. If the original upsert passed `fullName` directly and worked, the table has a `full_name` column and Supabase was erroring silently — using explicit snake_case keys here is the correct fix.

- [ ] **Step 3: Update `api/admin/registrations.ts`**

In `normalizeEmployee`, replace:

```ts
    department: asString(pick(row, "department", "department")),
    store: asString(pick(row, "store", "store")),
```

with:

```ts
    storeId: asString(pick(row, "storeId", "store_id")),
    store: asString(pick(row, "store", "store")),
```

In `normalizeTour`, delete:

```ts
    adultPrice: Number(pick(row, "adultPrice", "adult_price") ?? 0),
    childPrice: Number(pick(row, "childPrice", "child_price") ?? 0),
```

- [ ] **Step 4: Update `api/admin/export-registrations.ts`**

`normalizeEmployee` there only has `id` + `fullName` — no change needed. `normalizeTour` there only has `id` + `name` — no change needed. Verify both while in the file; if either grew price fields, remove them.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: all `api/` files clean.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Manual check (optional but recommended)**

If `vercel dev` is available: `vercel dev`, log into `/admin`, and from the browser devtools console run
`fetch('/api/admin/tour-config',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:'da_lat',pickupPoint:'self',price:3080000})}).then(r=>r.json()).then(console.log)`
Expected: `{ ok: true }`. Then query `destination_pricing` in Supabase to confirm the row.

- [ ] **Step 8: Commit**

```bash
git add api/admin/tour-config.ts api/admin/import-employees.ts api/admin/registrations.ts api/admin/export-registrations.ts
git commit -m "feat(api): admin tour-config takes meta or route-price patch; store_id rename"
```

---

## Task 7: Wizard — companion caps + required markers

**Files:**
- Modify: `src/components/wizard/RegistrationFormScreen.tsx`
- Modify: `src/components/wizard/CompanionFieldArray.tsx`
- Modify: `src/components/wizard/TransportSection.tsx`

**Interfaces:**
- Consumes: `<Label required>` from Task 4.
- Produces: `registrationFormSchema` allows up to 6 companions, ≤ 4 adults, ≤ 2 children; `RegistrationFormValues` type unchanged in shape. `CompanionFieldArray` blocks adding past the caps.

- [ ] **Step 1: Update the zod schema in `RegistrationFormScreen.tsx`**

Change `.array(companionSchema).max(4)` to `.array(companionSchema).max(6)`.

In the `superRefine` body, change the adult branch:

```ts
          } else {
            adultCount += 1
            if (adultCount > 4) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Đã đủ số lượng người lớn tối đa (4)',
                path: [index, 'dob'],
              })
            }
          }
```

(The child branch stays at `> 2` with its existing message.)

- [ ] **Step 2: Add the required-fields legend**

In the JSX, in the header block just under the `<p className="text-sm text-muted-foreground">{tour.name}</p>` line, add:

```tsx
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Trường bắt buộc
        </p>
```

- [ ] **Step 3: Mark the confirmation checkbox label required**

Change the confirmation `<Label htmlFor="confirmed" ...>` opening tag to include `required`:

```tsx
        <Label htmlFor="confirmed" required className="text-sm font-normal leading-snug">
          Tôi đã kiểm tra đầy đủ và xác nhận thông tin chính xác.
        </Label>
```

- [ ] **Step 4: Update `CompanionFieldArray.tsx` caps**

Change the helper text:

```tsx
        <p className="text-sm text-muted-foreground">
          Tối đa 4 người lớn (từ 10 tuổi) và 2 trẻ em (dưới 10 tuổi).
        </p>
```

In the counting loop, change the adult branch:

```ts
    } else {
      adultCount += 1
      if (adultCount > 4) overCapIndices.add(index)
    }
```

Change `capsReached`:

```ts
  const capsReached =
    fields.length >= 6 || (childCount >= 2 && adultCount >= 4)
```

Change `overCapMessage`:

```ts
        const overCapMessage =
          type === 'child'
            ? 'Đã đủ số lượng trẻ em tối đa (2)'
            : 'Đã đủ số lượng người lớn tối đa (4)'
```

- [ ] **Step 5: Mark companion field labels required**

In `CompanionFieldArray.tsx`, add `required` to all four field labels:

```tsx
                <Label htmlFor={`companions.${index}.fullName`} required>Họ và tên</Label>
```
```tsx
                <Label htmlFor={`companions.${index}.dob`} required>Ngày sinh</Label>
```
```tsx
                <Label required>Giới tính</Label>
```
```tsx
                <Label htmlFor={`companions.${index}.relationship`} required>
                  Mối quan hệ
                </Label>
```

- [ ] **Step 6: Mark the pickup-point label required in `TransportSection.tsx`**

Change:

```tsx
          <Label htmlFor="pickup-point">Điểm đón</Label>
```

to:

```tsx
          <Label htmlFor="pickup-point" required>Điểm đón</Label>
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: these three files clean. `RegistrationFormScreen.tsx` may still error on the `PricingSummary` props / `calculateTotal` — that is Task 8. If so, confirm the only remaining errors are the `PricingSummary` / pricing ones.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 9: Manual check**

Run: `npm run dev`, open the app, walk to a registration form (use any known-good MSNV URL, e.g. `/register/<employeeId>/<tourId>`). Confirm: red `*` on every companion field label, on "Điểm đón" after choosing "Di chuyển theo Xe Tour", and on the confirmation checkbox; "* Trường bắt buộc" legend visible; you can add up to 6 companions and the "Thêm người thân" button disables at 4 adults + 2 children (or 6 total); a 5th adult shows "Đã đủ số lượng người lớn tối đa (4)".

- [ ] **Step 10: Commit**

```bash
git add src/components/wizard/RegistrationFormScreen.tsx src/components/wizard/CompanionFieldArray.tsx src/components/wizard/TransportSection.tsx
git commit -m "feat(wizard): 4+2 companion caps and required-field markers"
```

---

## Task 8: Wizard — route-based pricing

**Files:**
- Modify: `src/components/wizard/RegistrationFormScreen.tsx`
- Modify: `src/components/wizard/PricingSummary.tsx`

**Interfaces:**
- Consumes: `getDestinationPricing` (Task 3), `resolveRouteKey` / `calculateTotal` (Task 2).
- Produces: `PricingSummary` new props `{ routePrice: number | undefined; transportMethod: TransportMethod; pickupPoint: PickupPoint | null; adultCount: number; hasChild: boolean }`.

- [ ] **Step 1: Rewrite `src/components/wizard/PricingSummary.tsx`**

Replace the entire file with:

```tsx
import type { PickupPoint, TransportMethod } from '../../types/domain'
import { calculateTotal } from '../../lib/pricing'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface PricingSummaryProps {
  routePrice: number | undefined
  transportMethod: TransportMethod
  pickupPoint: PickupPoint | null
  adultCount: number
  hasChild: boolean
}

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')} VNĐ`
}

function PricingSummary({
  routePrice,
  transportMethod,
  pickupPoint,
  adultCount,
  hasChild,
}: PricingSummaryProps) {
  const routeLabel = transportMethod === 'self' ? 'Tự túc' : pickupPoint ?? 'Chưa chọn điểm đón'
  const ticketCount = 1 + adultCount
  const total = routePrice === undefined ? undefined : calculateTotal(routePrice, adultCount)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Chi phí dự kiến</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Lộ trình đón:</span>
          <span className="font-medium">{routeLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Đơn giá / vé:</span>
          <span className="font-medium">
            {routePrice === undefined ? '—' : formatVnd(routePrice)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Số vé (nhân viên + người lớn):</span>
          <span className="font-medium">{ticketCount}</span>
        </div>
        {hasChild && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trẻ em:</span>
            <span className="font-medium">Không tính phí</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t pt-3">
          <span className="font-semibold">TỔNG TIỀN DỰ KIẾN:</span>
          <span className="text-lg font-bold text-primary">
            {total === undefined ? '—' : formatVnd(total)}
          </span>
        </div>
        {routePrice === undefined && (
          <p className="text-xs text-muted-foreground">
            Chọn điểm đón để xem giá.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default PricingSummary
```

- [ ] **Step 2: Wire pricing into `RegistrationFormScreen.tsx` — imports & state**

Update imports:

```tsx
import { useEffect, useState } from 'react'
```
```tsx
import { classifyAge, resolveRouteKey } from '../../lib/pricing'
import { getDestinationPricing, submitRegistration } from '../../lib/api'
```

Inside the component, after `const [submitError, setSubmitError] = useState<string | null>(null)`, add:

```tsx
  const [pricing, setPricing] = useState<Record<string, number> | null>(null)
  const [pricingError, setPricingError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPricingError(false)
    getDestinationPricing(employee.destination)
      .then((result) => {
        if (!cancelled) setPricing(result)
      })
      .catch(() => {
        if (!cancelled) setPricingError(true)
      })
    return () => {
      cancelled = true
    }
  }, [employee.destination])
```

- [ ] **Step 3: Derive route price and pass props**

After the `displayCompanions` definition, add:

```tsx
  const adultCount = displayCompanions.filter((companion) => companion.type === 'adult').length
  const hasChild = displayCompanions.some((companion) => companion.type === 'child')

  const transportMethod = useWatch({ control, name: 'transportMethod' }) ?? 'self'
  const pickupPoint = useWatch({ control, name: 'pickupPoint' }) ?? null
  const routeKey = resolveRouteKey(transportMethod, pickupPoint)
  const routePrice = routeKey && pricing ? pricing[routeKey] : undefined
```

Replace `<PricingSummary companions={displayCompanions} tour={tour} />` with:

```tsx
      <PricingSummary
        routePrice={routePrice}
        transportMethod={transportMethod}
        pickupPoint={pickupPoint}
        adultCount={adultCount}
        hasChild={hasChild}
      />
```

- [ ] **Step 4: Surface the pricing load error**

Just above the `<PricingSummary ... />` (or near `submitError`), add:

```tsx
      {pricingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Không tải được bảng giá, vui lòng tải lại trang.
          </AlertDescription>
        </Alert>
      )}
```

- [ ] **Step 5: Confirm `useWatch` is imported**

`RegistrationFormScreen.tsx` already imports `useWatch` from `react-hook-form`. Verify; if not, add it.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: clean across the whole repo except `EventTicket.tsx`, `EmployeeImportPanel.tsx`, `TourConfigTable.tsx` (Tasks 9–10).

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 8: Manual check**

Run: `npm run dev` (the `destination_pricing` table must exist and be seeded — migrations `0008` applied). On a registration form:
- Default "Tự túc" shows "Đơn giá / vé" = the `self` price for that destination, "Số vé" = 1, total = that price.
- Add 2 adult + 1 child companions → "Số vé" = 3, total = price × 3, and a "Trẻ em: Không tính phí" line appears.
- Switch to "Di chuyển theo Xe Tour" without picking a point → price/total show "—" and the "Chọn điểm đón để xem giá." hint.
- Pick "Đà Nẵng" → price/total update to the Đà Nẵng rate.

- [ ] **Step 9: Commit**

```bash
git add src/components/wizard/RegistrationFormScreen.tsx src/components/wizard/PricingSummary.tsx
git commit -m "feat(wizard): route-based pricing summary"
```

---

## Task 9: `store_id` UI surfaces

**Files:**
- Modify: `src/components/ticket/EventTicket.tsx`
- Modify: `src/components/admin/EmployeeImportPanel.tsx`

**Interfaces:**
- Consumes: `Employee.storeId` (Task 2), `importEmployees` (unchanged signature, forwards `storeId`).
- Produces: nothing downstream.

- [ ] **Step 1: `EventTicket.tsx`**

In the `infoRows` array, change:

```ts
  { label: 'Mã siêu thị', value: employee.department },
```

to:

```ts
  { label: 'Mã siêu thị', value: employee.storeId },
```

- [ ] **Step 2: `EmployeeImportPanel.tsx`**

In `toEmployeeRow`, change:

```ts
    department: String(row['Bộ phận'] ?? '').trim(),
```

to:

```ts
    storeId: String(row['Mã siêu thị'] ?? '').trim(),
```

If there is any visible helper text in this component listing the expected columns (search the file for `Bộ phận`), update `Bộ phận` → `Mã siêu thị` there too.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: both files clean.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Manual check**

Build an `.xlsx` with a header row `MSNV | Họ tên | Mã siêu thị | Siêu thị | Điểm đến` and one `nha_trang` row. In `/admin` → import tab, upload it; confirm it imports with no error and the `employees` row in Supabase has `store_id` populated. Then open that employee's ticket and confirm the "Mã siêu thị" line shows the value.

- [ ] **Step 6: Commit**

```bash
git add src/components/ticket/EventTicket.tsx src/components/admin/EmployeeImportPanel.tsx
git commit -m "feat: employee store_id on ticket and Excel import"
```

---

## Task 10: Admin grouped config table

**Files:**
- Modify: `src/components/admin/TourConfigTable.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getAllTours`, `getAllDestinationPricing`, `updateTourConfig`, `updateDestinationPrice`, `SessionExpiredError` (Task 3); `Tour`, `DestinationPricing`, `Destination`, `RouteKey` (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Replace `src/components/admin/TourConfigTable.tsx` with the grouped table**

```tsx
import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Destination, DestinationPricing, Tour } from '@/types/domain'
import {
  getAllDestinationPricing,
  getAllTours,
  updateDestinationPrice,
  updateTourConfig,
  SessionExpiredError,
} from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROUTES: Array<{ key: string; label: string }> = [
  { key: 'self', label: 'Tự túc' },
  { key: 'Hà Tĩnh', label: 'Hà Tĩnh' },
  { key: 'Quảng Bình', label: 'Quảng Bình' },
  { key: 'Quảng Trị', label: 'Quảng Trị' },
  { key: 'TP. Huế', label: 'TP. Huế' },
  { key: 'Đà Nẵng', label: 'Đà Nẵng' },
  { key: 'Quảng Nam', label: 'Quảng Nam' },
  { key: 'Quảng Ngãi', label: 'Quảng Ngãi' },
]

interface TourMetaState {
  name: string
  startDate: string
  endDate: string
  maxCapacity: string
}

function toMetaState(tour: Tour): TourMetaState {
  return {
    name: tour.name,
    startDate: tour.startDate,
    endDate: tour.endDate,
    maxCapacity: String(tour.maxCapacity),
  }
}

function priceKey(destination: Destination, route: string): string {
  return `${destination}::${route}`
}

interface TourConfigTableProps {
  onSessionExpired: () => void
}

function TourConfigTable({ onSessionExpired }: TourConfigTableProps) {
  const [tours, setTours] = useState<Tour[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [meta, setMeta] = useState<Record<string, TourMetaState>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = async () => {
    setLoadError(false)
    try {
      const [tourData, priceData] = await Promise.all([
        getAllTours(),
        getAllDestinationPricing(),
      ])
      setTours(tourData)
      setMeta(Object.fromEntries(tourData.map((tour) => [tour.id, toMetaState(tour)])))
      setPrices(
        Object.fromEntries(
          priceData.map((row: DestinationPricing) => [
            priceKey(row.destination, row.pickupPoint),
            String(row.price),
          ]),
        ),
      )
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleError = (err: unknown, fallbackMsg: string): boolean => {
    if (err instanceof SessionExpiredError) {
      onSessionExpired()
      return true
    }
    setRowError(fallbackMsg)
    return false
  }

  const updateMetaField = (tourId: string, field: keyof TourMetaState, value: string) => {
    setMeta((prev) => ({ ...prev, [tourId]: { ...prev[tourId], [field]: value } }))
    if (savedId === tourId) setSavedId(null)
  }

  const updatePriceField = (key: string, value: string) => {
    setPrices((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveMeta = async (tour: Tour) => {
    const row = meta[tour.id]
    setSavingId(tour.id)
    setRowError(null)
    try {
      await updateTourConfig(tour.id, {
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        maxCapacity: Number(row.maxCapacity),
      })
      setSavedId(tour.id)
      await load()
    } catch (err) {
      handleError(err, 'Không thể lưu cấu hình tour. Vui lòng thử lại.')
    } finally {
      setSavingId(null)
    }
  }

  const handleSavePrice = async (destination: Destination, route: string) => {
    const key = priceKey(destination, route)
    setSavingId(key)
    setRowError(null)
    try {
      await updateDestinationPrice(destination, route, Number(prices[key]))
      setSavedId(key)
      await load()
    } catch (err) {
      handleError(err, 'Không thể lưu giá lộ trình. Vui lòng thử lại.')
    } finally {
      setSavingId(null)
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Không thể tải cấu hình. Vui lòng thử lại.</AlertDescription>
        </Alert>
        <Button type="button" onClick={load} className="self-start">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!tours) {
    return <p className="text-sm text-muted-foreground">Đang tải...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Cấu hình Tour</h2>
        <p className="text-sm text-muted-foreground">
          Chỉnh thông tin tour (tên, ngày, sức chứa) và giá vé theo lộ trình đón. Giá lộ
          trình áp dụng chung cho tất cả tour cùng điểm đến.
        </p>
      </div>

      {rowError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{rowError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        {tours.map((tour) => {
          const row = meta[tour.id]
          if (!row) return null
          return (
            <div key={tour.id} className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Tour / Lộ trình</TableHead>
                    <TableHead className="min-w-[320px]">Cấu hình</TableHead>
                    <TableHead className="min-w-[120px]">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/50">
                    <TableCell className="align-top font-semibold">
                      {tour.name}
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        Đã đăng ký: {tour.registeredCount}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Tên tour
                          <Input
                            value={row.name}
                            onChange={(e) => updateMetaField(tour.id, 'name', e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Sức chứa
                          <Input
                            type="number"
                            min={0}
                            value={row.maxCapacity}
                            onChange={(e) => updateMetaField(tour.id, 'maxCapacity', e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Ngày bắt đầu
                          <Input
                            type="date"
                            value={row.startDate}
                            onChange={(e) => updateMetaField(tour.id, 'startDate', e.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Ngày kết thúc
                          <Input
                            type="date"
                            value={row.endDate}
                            onChange={(e) => updateMetaField(tour.id, 'endDate', e.target.value)}
                          />
                        </label>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-start gap-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveMeta(tour)}
                          disabled={savingId === tour.id}
                        >
                          {savingId === tour.id ? 'Đang lưu...' : 'Lưu tour'}
                        </Button>
                        {savedId === tour.id && (
                          <span className="text-xs font-medium text-emerald-600">Đã lưu</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {ROUTES.map((route) => {
                    const key = priceKey(tour.destination, route.key)
                    return (
                      <TableRow key={key}>
                        <TableCell className="pl-8 text-sm text-muted-foreground">
                          {route.label}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={prices[key] ?? ''}
                            onChange={(e) => updatePriceField(key, e.target.value)}
                            className="max-w-[200px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleSavePrice(tour.destination, route.key)}
                              disabled={savingId === key}
                            >
                              {savingId === key ? 'Đang lưu...' : 'Lưu giá'}
                            </Button>
                            {savedId === key && (
                              <span className="text-xs font-medium text-emerald-600">Đã lưu</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {tour.destination === 'nha_trang' && (
                <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  Giá áp dụng chung cho tất cả tour Nha Trang.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TourConfigTable
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: whole repo clean now.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Manual check**

Needs `vercel dev` (admin API routes) + migrations `0007`–`0010` applied. Log into `/admin` → "Cấu hình Tour":
- Five tour blocks render, each with an editable name/capacity/dates group row and 8 price sub-rows (`Tự túc` + 7 provinces).
- Edit the Đà Lạt "Tự túc" price, click "Lưu giá" → "Đã lưu"; reload → value persists; open a Đà Lạt registration form → the new self price shows.
- Edit a price under "Nha Trang 1", reload → the same value appears under Nha Trang 2/3/4; the "Giá áp dụng chung…" note is shown on all four Nha Trang blocks.
- Change a tour's `max_capacity` and dates, "Lưu tour" → persists after reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/TourConfigTable.tsx
git commit -m "feat(admin): grouped tour config with per-route pricing"
```

---

## Task 11: Update `requirements.md` + full build

**Files:**
- Modify: `requirements.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Companion cap wording**

Line ~25 (flow diagram): change `Người thân đi cùng (Max 2 Trẻ + 2 NL)` to `Người thân đi cùng (Max 2 Trẻ + 4 NL)`.

Line ~89: change

```
    - Người lớn trên 10 tuổi: Tối đa **2 người** (Người thân 1 - Người thân 2).
```

to

```
    - Người lớn trên 10 tuổi: Tối đa **4 người**.
```

- [ ] **Step 2: Pricing section (§2.3 "#### 3. Bảng giá Tour tham khảo")**

Replace the three cost bullets:

```
    - Chi phí cho Nhân viên: **0 VNĐ** (100% Công ty tài trợ).
    - Chi phí Người lớn đi kèm: `Đơn giá người lớn × Số lượng người lớn`.
    - Chi phí Trẻ em đi kèm: `Đơn giá trẻ em × Số lượng trẻ em`.
    - **TỔNG TIỀN DỰ KIẾN:** Displays total calculation.
```

with:

```
    - Giá vé theo **lộ trình đón** của điểm đến (Tự túc hoặc 1 trong 7 điểm đón),
      không phân biệt người lớn / trẻ em.
    - Số vé phải trả tiền = **Nhân viên (1) + số người lớn đi kèm**. Trẻ em dưới 10
      tuổi không tính phí.
    - **TỔNG TIỀN DỰ KIẾN** = `Đơn giá lộ trình × Số vé phải trả tiền`.
    - Bảng giá theo lộ trình được quản trị cấu hình ở trang `/admin` (lưu trong bảng
      `destination_pricing`).
```

- [ ] **Step 3: Employee columns note (§5 admin, "Employee management")**

Find the sentence listing the Excel columns (`MSNV (→ id), Họ tên, Bộ phận, Siêu thị, Điểm đến`) and change `Bộ phận` to `Mã siêu thị` (mapped to `store_id`).

- [ ] **Step 4: Full build**

Run: `npm run build`
Expected: `tsc -b` passes and `vite build` completes with no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add requirements.md
git commit -m "docs: requirements.md route pricing, 4+2 caps, store_id"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §2 `employees.department` → `store_id` | 1 (migration 0007), 2 (`domain.ts`), 3 (`mapEmployee`), 6 (import API + admin normalizers), 9 (ticket + import panel) |
| §2 drop `tours.adult_price`/`child_price` | 1 (migration 0010), 2 (`Tour` type), 3 (`mapTour`), 6 (admin normalizers) |
| §2 new `destination_pricing` table + RLS + seed | 1 (migration 0008) |
| §2 `DestinationPricing` / `RouteKey` types | 2 |
| §3 pricing formula `routePrice × (1 + adultCount)` | 2 (`calculateTotal`), 8 (wizard), 1 (RPC 0009) |
| §3 `submit_registration` rewrite, signature stable | 1 (migration 0009), 5 (`api/register.ts`) |
| §3 `api/register.ts` cap `> 6`, drop price read, `p_total_price: 0`, new errors | 5 |
| §3 `src/lib/api.ts` mappers + `getDestinationPricing` + `getAllDestinationPricing` + `updateDestinationPrice` + widened `updateTourConfig` | 3 |
| §4 admin grouped config table | 10 |
| §4 `api/admin/tour-config.ts` meta-patch or price-patch | 6 |
| §5 `Label` `required` prop | 4 |
| §5 `RegistrationFormScreen` pricing fetch + caps + legend + checkbox | 7, 8 |
| §5 `CompanionFieldArray` caps 4+2 + required labels + helper text | 7 |
| §5 `TransportSection` required pickup label | 7 |
| §5 `PricingSummary` rewrite | 8 |
| §5 `EventTicket` `storeId` | 9 |
| §5 `EmployeeImportPanel` `Mã siêu thị` column | 9 |
| §5 `api/admin/import-employees.ts` + `registrations.ts` + `export-registrations.ts` | 6 |
| §6 four ordered migrations | 1 |
| §8 QA checklist | manual-check steps in Tasks 5–10 |

No gaps.

**Placeholder scan:** No `TBD` / `add error handling` / bare "write tests" placeholders. Every code step has literal content. The one "verify while in the file" step (Task 6 Step 4) is a genuine no-op check with a stated expected state, not deferred work.

**Type consistency:**
- `getDestinationPricing` returns `Record<string, number>` in Task 3 and is consumed as `Record<string, number> | null` state in Task 8 — consistent.
- `resolveRouteKey(transportMethod, pickupPoint)` defined in Task 2 as `(TransportMethod, PickupPoint | null) => RouteKey | null`; called in Task 8 with `transportMethod` (defaulted to `'self'`) and `pickupPoint` (defaulted to `null`) — consistent.
- `calculateTotal(routePrice, adultCount)` defined Task 2, used in Task 8's `PricingSummary` with `(number, number)` — consistent.
- `updateTourConfig(tourId, changes)` widened in Task 3 to `Partial<Pick<Tour, "name" | "startDate" | "endDate" | "maxCapacity">>`; called in Task 10 with exactly those keys — consistent.
- `updateDestinationPrice(destination, pickupPoint, price)` defined Task 3, called Task 10 as `(tour.destination, route.key, Number(...))` — consistent.
- RPC return key `total_price` (Task 1) is what `api/register.ts` reads (Task 5) — consistent.
- `PricingSummary` prop set defined in Task 8 Step 1 matches what `RegistrationFormScreen` passes in Task 8 Step 3 — consistent.
- Admin `tour-config` price-patch body `{ destination, pickupPoint, price }` (Task 6) matches `updateDestinationPrice`'s POST body (Task 3) — consistent.

No inconsistencies found.
