# Tour Registration UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete front-end UI for the 4-screen employee tour-registration wizard plus the admin page, using mock/local data and stubbed handlers, so the flow is fully clickable and visually complete ahead of backend wiring.

**Architecture:** A Vite + React + TypeScript SPA using React Router (`/` for the wizard, `/admin` for the admin page). UI components come from shadcn/ui (built on Radix + Tailwind). Tailwind provides the design-token layer (colors, spacing, typography) and utility classes everywhere. Less is used only for the Event Ticket component, which needs custom print-friendly layout beyond what Tailwind utilities comfortably express. All data (employees, tours, registrations) is served from an in-memory mock data module so every screen is navigable and testable without a backend; a later plan swaps the mock module for real Supabase calls behind the same interfaces.

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, Tailwind CSS, shadcn/ui (Radix primitives), Less, react-hook-form + zod, html-to-image (wired but only exercised against the mock ticket data).

## Global Constraints

- **Mobile-first, fully responsive:** this site is used on mobile more than desktop. Design and build every screen mobile-first (base Tailwind classes target small screens, `md:`/`lg:` breakpoints layer on enhancements for larger viewports). Verify every task's manual QA on a mobile viewport (browser dev tools device toolbar, e.g. ~375px width) as well as desktop width, not desktop-only.
- Employee-facing copy must match `requirements.md` exactly, including the red error message in §2.1: "User nhân viên không nằm trong danh sách đăng ký tham gia Du Lịch, vui lòng liên hệ Hoàng DM - 24776 để được hỗ trợ."
- Đà Lạt: 1 tour, max 750 capacity. Nha Trang: 4 tours (28/09–30/09, 07/10–09/10, 19/10–21/10, 21/10–23/10), max 450 capacity each.
- Companions: max 2 children (<10y) + 2 adults (≥10y) per registration; age classification is derived from DOB.
- Pickup dropdown (only shown when "Di chuyển theo Xe Tour" is selected) has exactly 7 options: Hà Tĩnh, Quảng Bình, Quảng Trị, TP. Huế, Đà Nẵng, Quảng Nam, Quảng Ngãi.
- Employee is always free (0đ); companion pricing is per-tour (adult/child rates differ by tour).
- This plan is UI-only: no real Supabase/serverless calls. All async operations use the mock data module and `setTimeout`-simulated latency where relevant, behind interfaces the next plan will implement for real.
- No automated test suite for this plan (per user decision) — verification is manual, via `npm run dev` and clicking through each screen.

---

## File Structure

```
tours/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json                  # shadcn/ui config
├── index.html
├── src/
│   ├── main.tsx                     # React root + router setup
│   ├── App.tsx                      # <Routes>: "/" wizard, "/admin" admin
│   ├── index.css                    # Tailwind directives + CSS vars (design tokens)
│   ├── lib/
│   │   ├── utils.ts                 # shadcn `cn()` helper
│   │   ├── mockData.ts              # in-memory employees/tours/registrations + query fns
│   │   └── pricing.ts               # classifyAge(), calculateTotal()
│   ├── types/
│   │   └── domain.ts                # Employee, Tour, Companion, Registration, TransportMethod types
│   ├── components/ui/               # shadcn-generated primitives (button, card, input, dialog, etc.)
│   ├── components/wizard/
│   │   ├── WizardLayout.tsx          # shared shell (banner/header) for screens 1-4
│   │   ├── WelcomeScreen.tsx         # Screen 1
│   │   ├── TourSelectionScreen.tsx   # Screen 2
│   │   ├── RegistrationFormScreen.tsx # Screen 3 (composes CompanionFieldArray, TransportSection, PricingSummary)
│   │   ├── CompanionFieldArray.tsx   # dynamic companion sub-form
│   │   ├── TransportSection.tsx     # transport method + pickup dropdown
│   │   ├── PricingSummary.tsx       # live price breakdown
│   │   └── TicketScreen.tsx         # Screen 4
│   ├── components/ticket/
│   │   ├── EventTicket.tsx           # ticket markup, uses ticket.less
│   │   └── ticket.less
│   ├── components/admin/
│   │   ├── AdminLoginForm.tsx
│   │   ├── AdminLayout.tsx           # tab shell: Employees / Tours / Registrations
│   │   ├── EmployeeImportPanel.tsx
│   │   ├── TourConfigTable.tsx
│   │   └── RegistrationsTable.tsx
│   └── pages/
│       ├── WizardPage.tsx            # owns wizard step state, renders current screen
│       └── AdminPage.tsx             # owns admin auth state, renders login or AdminLayout
```

Rationale: `components/wizard`, `components/ticket`, and `components/admin` split by feature area (files that change together live together). `lib/mockData.ts` and `lib/pricing.ts` are the seams the next (backend) plan will replace — everything else consumes them through the type-safe interfaces in `types/domain.ts`, so swapping mock for real data later touches only those two files plus wherever async calls are awaited.

---

### Task 1: Scaffold project (Vite + React + TS + Tailwind + shadcn/ui + Less)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `tailwind.config.ts`, `postcss.config.js`, `components.json`, `src/lib/utils.ts`
- Create: `.gitignore` (Vite default: `node_modules`, `dist`, etc.)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running Vite dev server at `npm run dev`; Tailwind classes usable anywhere under `src/`; shadcn/ui CLI ready to generate components into `src/components/ui/`; `.less` files importable in any `.tsx` (via `vite-plugin-... ` — Vite has built-in Less support, only requires the `less` package installed, no plugin needed); the `cn()` helper exported from `src/lib/utils.ts` for class merging.

- [ ] **Step 1: Scaffold the Vite React-TS app**

Run: `npm create vite@latest . -- --template react-ts` (in the repo root; since `requirements.md` and `docs/` already exist, confirm "yes" to writing into the non-empty directory when prompted).

- [ ] **Step 2: Install base dependencies**

Run: `npm install` then `npm install -D less tailwindcss postcss autoprefixer` then `npx tailwindcss init -p` to generate `tailwind.config.ts`/`postcss.config.js`.

- [ ] **Step 3: Configure Tailwind content globs and design tokens**

In `tailwind.config.ts`, set:
```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

Run: `npm install -D tailwindcss-animate`

- [ ] **Step 4: Add Tailwind directives and CSS variables to `src/index.css`**

Replace the generated file's contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 5: Set up path aliases for shadcn/ui**

In `tsconfig.json` add under `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```
In `vite.config.ts`:
```ts
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 6: Initialize shadcn/ui**

Run: `npx shadcn@latest init` — when prompted, choose: TypeScript yes, style "New York" or "Default" (either is fine), base color "Slate", CSS variables yes, `tailwind.config.ts` path confirmed, `src/index.css` confirmed, import alias `@/components`, `@/lib/utils`. This generates `components.json` and `src/lib/utils.ts` (exporting `cn()`).

- [ ] **Step 7: Verify Less works in Vite**

Create a throwaway `src/App.less` with `.scaffold-test { color: red; }`, import it in `App.tsx`, run `npm run dev`, confirm no build error in the terminal, then delete the throwaway file and its import.

Run: `npm run dev` (initial_wait 30s is enough — Vite starts in ~1s). Expected: server starts on `http://localhost:5173` with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + shadcn/ui + Less"
```

---

### Task 2: Domain types and mock data module

**Files:**
- Create: `src/types/domain.ts`
- Create: `src/lib/mockData.ts`
- Create: `src/lib/pricing.ts`

**Interfaces:**
- Consumes: nothing beyond Task 1's scaffold.
- Produces (used by every later task):
  - Types in `src/types/domain.ts`:
    - `type Destination = "da_lat" | "nha_trang"`
    - `type TransportMethod = "self" | "tour_bus"`
    - `type PickupPoint = "Hà Tĩnh" | "Quảng Bình" | "Quảng Trị" | "TP. Huế" | "Đà Nẵng" | "Quảng Nam" | "Quảng Ngãi"`
    - `interface Employee { id: string; fullName: string; department: string; store: string; destination: Destination }`
    - `interface Tour { id: string; destination: Destination; name: string; startDate: string; endDate: string; maxCapacity: number; registeredCount: number; adultPrice: number; childPrice: number; pdfUrl: string; imageUrl: string }`
    - `interface Companion { id: string; fullName: string; dob: string; gender: "male" | "female"; relationship: string; type: "adult" | "child" }`
    - `interface Registration { id: string; employeeId: string; tourId: string; transportMethod: TransportMethod; pickupPoint: PickupPoint | null; companions: Companion[]; totalPrice: number; createdAt: string }`
  - Functions in `src/lib/mockData.ts`:
    - `findEmployeeById(id: string): Employee | undefined`
    - `findRegistrationByEmployeeId(employeeId: string): Registration | undefined`
    - `getToursByDestination(destination: Destination): Tour[]`
    - `getTourById(id: string): Tour | undefined`
    - `submitRegistration(input: Omit<Registration, "id" | "createdAt" | "totalPrice">): Promise<{ ok: true; registration: Registration } | { ok: false; error: string }>` — simulates the capacity-check RPC: rejects with `{ ok: false, error: "Tour đã đầy, vui lòng chọn tour khác." }` if `registeredCount >= maxCapacity`, otherwise increments `registeredCount` on the in-memory tour, computes `totalPrice` via `calculateTotal`, pushes a new `Registration`, and resolves after a `300ms` `setTimeout` (simulated latency).
  - Functions in `src/lib/pricing.ts`:
    - `classifyAge(dob: string): "adult" | "child"` — returns `"child"` if age at "today" is `< 10`, else `"adult"`.
    - `calculateTotal(companions: Companion[], tour: Tour): number` — sums `adultPrice` for each `type === "adult"` companion and `childPrice` for each `type === "child"` companion (employee is always free, contributes 0).

- [ ] **Step 1: Write `src/types/domain.ts`** with the exact type definitions listed above.

- [ ] **Step 2: Write `src/lib/pricing.ts`**

```ts
import type { Companion, Tour } from "@/types/domain";

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

export function calculateTotal(companions: Companion[], tour: Tour): number {
  return companions.reduce((sum, c) => {
    return sum + (c.type === "adult" ? tour.adultPrice : tour.childPrice);
  }, 0);
}
```

- [ ] **Step 3: Write `src/lib/mockData.ts`**

Seed with:
- One employee `{ id: "8830", fullName: "Nguyễn Thị Phương Linh", department: "BP Quản Lý Siêu Thị - ĐMX", store: "TGD_NAN_VIN - 180 Nguyễn Du", destination: "da_lat" }` and a second `{ id: "9001", fullName: "Trần Văn Bình", department: "BP Kho Vận", store: "TGD_HCM_Q1 - 12 Lê Lợi", destination: "nha_trang" }`.
- One Đà Lạt tour (`maxCapacity: 750`, `registeredCount: 430`, `adultPrice: 2500000`, `childPrice: 1200000`) and four Nha Trang tours named "Nha Trang 1".."Nha Trang 4" with the exact date ranges from the Global Constraints section, each `maxCapacity: 450` and varied `registeredCount` (e.g. 120, 300, 449, 450 — the last one demonstrates the "full" state for manual QA).
- Empty `registrations: Registration[]` array, mutated in place by `submitRegistration`.
- Implement `findEmployeeById`, `findRegistrationByEmployeeId`, `getToursByDestination`, `getTourById`, and `submitRegistration` exactly per the signatures above, importing `calculateTotal` from `./pricing`.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then in `src/App.tsx` temporarily add `console.log(findEmployeeById("8830"))` and confirm the object logs correctly in the browser console; remove the debug line afterward.

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/lib/mockData.ts src/lib/pricing.ts
git commit -m "feat: add domain types, mock data, and pricing logic"
```

---

### Task 3: Routing shell and shared wizard layout

**Files:**
- Create: `src/pages/WizardPage.tsx`
- Create: `src/pages/AdminPage.tsx` (stub only — full content in Task 8)
- Create: `src/components/wizard/WizardLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: none new.
- Produces:
  - `WizardPage` owns step state: `type WizardStep = "welcome" | "tours" | "register" | "ticket"`, plus `employee: Employee | null`, `selectedTour: Tour | null`, `registration: Registration | null` — all via `useState`, passed down as props to whichever screen is rendered for the current step. Later tasks (4-7) consume these as props and call step-transition callbacks (`onEmployeeVerified`, `onTourSelected`, `onRegistrationSubmitted`) that `WizardPage` passes down.
  - `WizardLayout` renders a shared header (event banner title "Tour Du Lịch Vùng Trung Bộ 2026") wrapping `{children}`, used by every wizard screen for visual consistency.
  - Routes: `/` → `WizardPage`, `/admin` → `AdminPage`.

- [ ] **Step 1: Install React Router**

Run: `npm install react-router-dom`

- [ ] **Step 2: Write `src/components/wizard/WizardLayout.tsx`**

A simple wrapper component: full-height centered container (Tailwind: `min-h-screen bg-background flex flex-col items-center`), a header banner showing the event title, and a `<main>` that renders `children` in a centered, max-width card area. No business logic — purely presentational scaffolding reused by all 4 screens.

- [ ] **Step 3: Write `src/pages/WizardPage.tsx`**

Holds the wizard state described in Interfaces above. For this task, render only a placeholder: wrap `WizardLayout` around a `<p>` showing the current step name, so routing can be verified before Tasks 4-7 fill in real screens.

- [ ] **Step 4: Write a stub `src/pages/AdminPage.tsx`**

Renders `<div>Admin page (coming in Task 8)</div>` — just enough for the route to resolve.

- [ ] **Step 5: Wire routing in `src/main.tsx` and `src/App.tsx`**

`main.tsx` wraps `<App />` in `<BrowserRouter>`. `App.tsx` renders `<Routes><Route path="/" element={<WizardPage />} /><Route path="/admin" element={<AdminPage />} /></Routes>`.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, visit `http://localhost:5173/` (expect the wizard placeholder showing step "welcome") and `http://localhost:5173/admin` (expect the admin stub text).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add routing shell and wizard layout"
```

---

### Task 4: Screen 1 — Welcome / MSNV entry

**Files:**
- Create: `src/components/wizard/WelcomeScreen.tsx`
- Modify: `src/pages/WizardPage.tsx` (render `WelcomeScreen` for the `"welcome"` step)
- Modify: `src/lib/mockData.ts` (no changes expected — already covers this; skip if nothing to add)

**Interfaces:**
- Consumes: `findEmployeeById`, `findRegistrationByEmployeeId` from `src/lib/mockData.ts` (Task 2).
- Produces: `WelcomeScreen` props `{ onVerified: (employee: Employee, existingRegistration: Registration | null) => void }`. `WizardPage` uses this callback to set `employee` state and, if `existingRegistration` is non-null, jump straight to `"ticket"` step (per spec: an employee who already registered goes straight to their ticket); otherwise advance to `"tours"`.

**What the screen needs (describe, not prescribe markup):**
- Event banner/title (reuses `WizardLayout`'s header — no duplicate banner needed here).
- A labeled text input for "Mã số nhân viên (MSNV)" (shadcn `Input` + `Label`).
- A "Kiểm tra" button (shadcn `Button`) that looks up the entered ID via `findEmployeeById`.
- Not-found state: an inline red alert (shadcn `Alert` with `variant="destructive"`) showing the exact copy from Global Constraints ("User nhân viên không nằm trong danh sách...").
- Found state: no visible message needed — immediately calls `onVerified(employee, existingRegistration)` (looked up via `findRegistrationByEmployeeId(employee.id)`).
- Basic empty-input guard: disable the "Kiểm tra" button (or show a lightweight inline validation message) when the input is blank, so users can't submit an empty MSNV.

- [ ] **Step 1: Install needed shadcn components**

Run: `npx shadcn@latest add input label button alert`

- [ ] **Step 2: Implement `WelcomeScreen.tsx`** per the description above, using local `useState` for the input value and the not-found error flag.

- [ ] **Step 3: Wire into `WizardPage.tsx`**

Render `<WelcomeScreen onVerified={(employee, existingRegistration) => { setEmployee(employee); if (existingRegistration) { setRegistration(existingRegistration); setStep("ticket"); } else { setStep("tours"); } }} />` when `step === "welcome"`.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Enter `"8830"` → should advance to the tours step placeholder (from Task 3) since that employee has no registration yet. Enter `"0000"` → should show the red alert with the exact spec wording. Enter `"9001"` after manually pushing a mock registration for it in `mockData.ts` (temporary test tweak, then revert) → should jump straight to the ticket step placeholder.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement welcome/MSNV verification screen"
```

---

### Task 5: Screen 2 — Tour selection

**Files:**
- Create: `src/components/wizard/TourSelectionScreen.tsx`
- Modify: `src/pages/WizardPage.tsx` (render `TourSelectionScreen` for the `"tours"` step)

**Interfaces:**
- Consumes: `getToursByDestination` from `src/lib/mockData.ts`; `Tour`, `Employee` types from Task 2.
- Produces: `TourSelectionScreen` props `{ employee: Employee; onTourSelected: (tour: Tour) => void }`. `WizardPage` uses this to set `selectedTour` state and advance to `"register"` step.

**What the screen needs:**
- Fetches `getToursByDestination(employee.destination)` and renders one card per tour (shadcn `Card`).
- Each card shows: tour name, destination, date range (`startDate`–`endDate`), a placeholder image (`imageUrl`, use a static placeholder path like `/placeholder-tour.jpg`), and a capacity badge reading `"Còn lại {maxCapacity - registeredCount}/{maxCapacity} chỗ"` (shadcn `Badge`).
- A "Xem lịch trình Tour / Địa điểm du lịch (PDF)" link/button per card that opens `pdfUrl` in a new tab (`target="_blank" rel="noopener noreferrer"`).
- A "Đăng ký" button per card. If the tour is full (`registeredCount >= maxCapacity`), this button is disabled and shows "Đã hết chỗ" instead, so the full-tour edge case (mock data includes one) is visible without needing Screen 3's submit-time check.
- Layout: Đà Lạt renders exactly 1 card; Nha Trang renders 4 cards in a responsive grid — single column by default (mobile), 2 columns from `md:` up (Tailwind `grid grid-cols-1 md:grid-cols-2 gap-4`). Cards must remain fully readable and tappable at ~375px width (no horizontal overflow, touch-friendly button sizing).

- [ ] **Step 1: Install needed shadcn components**

Run: `npx shadcn@latest add card badge`

- [ ] **Step 2: Add a placeholder tour image**

Create `public/placeholder-tour.jpg` — any small placeholder image file (or reuse Vite's default `public/vite.svg` renamed/copied) so `<img>` tags don't 404. Point every seeded tour's `imageUrl` in `mockData.ts` at `/placeholder-tour.jpg`.

- [ ] **Step 3: Implement `TourSelectionScreen.tsx`** per the description above.

- [ ] **Step 4: Wire into `WizardPage.tsx`**

Render `<TourSelectionScreen employee={employee} onTourSelected={(tour) => { setSelectedTour(tour); setStep("register"); }} />` when `step === "tours"` (guard: only reachable once `employee` is set).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Verify with employee `"8830"` (Đà Lạt) → exactly 1 card shown. Temporarily change the seed employee to `destination: "nha_trang"` in `mockData.ts` (or use employee `"9001"`) → 4 cards shown, including one disabled "Đã hết chỗ" card per the seeded full tour. Confirm the PDF link opens a new tab (can point `pdfUrl` at any placeholder URL like `https://example.com/itinerary.pdf` for this check).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: implement tour selection screen"
```

---

### Task 6: Screen 3 — Registration form (companions, transport, pricing, confirmation)

**Files:**
- Create: `src/components/wizard/RegistrationFormScreen.tsx`
- Create: `src/components/wizard/CompanionFieldArray.tsx`
- Create: `src/components/wizard/TransportSection.tsx`
- Create: `src/components/wizard/PricingSummary.tsx`
- Modify: `src/pages/WizardPage.tsx` (render `RegistrationFormScreen` for the `"register"` step)

**Interfaces:**
- Consumes: `classifyAge`, `calculateTotal` from `src/lib/pricing.ts`; `submitRegistration` from `src/lib/mockData.ts`; `Employee`, `Tour`, `Companion`, `TransportMethod`, `PickupPoint` types from Task 2.
- Produces:
  - `RegistrationFormScreen` props `{ employee: Employee; tour: Tour; onSubmitted: (registration: Registration) => void }`. On successful submit, calls `onSubmitted(registration)`; `WizardPage` uses this to set `registration` state and advance to `"ticket"`.
  - `CompanionFieldArray` props `{ control: Control<RegistrationFormValues> }` (react-hook-form `useFieldArray` under the hood) — renders and manages the repeatable companion sub-forms; exposes no other public surface (fully self-contained under the parent form's `control`).
  - `TransportSection` props `{ control: Control<RegistrationFormValues> }` — renders the transport radio + conditional pickup dropdown, again scoped to the same form via `control`.
  - `PricingSummary` props `{ companions: Companion[]; tour: Tour }` — pure display component, no form dependency, so it can be reused/tested independently.
  - Shared form schema (zod), defined in `RegistrationFormScreen.tsx` and exported as `type RegistrationFormValues`, used by all three child components: `{ companions: Array<{ fullName: string; dob: string; gender: "male" | "female"; relationship: string }>; transportMethod: TransportMethod; pickupPoint: PickupPoint | null; confirmed: boolean }`.

**What the form needs:**
- **Companions section:** "+ Thêm người thân" button (shadcn `Button` variant `outline`) appends a blank companion row, up to a combined max of 2 "child" + 2 "adult" (computed live via `classifyAge` on each row's `dob` as it's filled in — once 2 rows classify as child, disable adding more until an adult slot is still open, and vice versa; the "+ Thêm người thân" button disables entirely once both caps (2+2) are reached). Each row: full name (`Input`), DOB (`Input type="date"`), gender (shadcn `Select` or `RadioGroup`: Nam/Nữ), relationship (`Input` or `Select` with common values: Vợ/Chồng, Con, Bố/Mẹ, Khác), and a remove button (shadcn `Button` variant `ghost`, icon). On mobile, stack each companion row's fields in a single column (full-width inputs) rather than a multi-column grid; a `md:` grid (e.g. 2 columns) can be used at wider viewports.
- **Transport section:** shadcn `RadioGroup` with two options ("Tự túc theo Tour Công ty" / "Di chuyển theo Xe Tour"). When "Di chuyển theo Xe Tour" is selected, reveal a `Select` dropdown of the 7 pickup provinces from Global Constraints, required in that case (validated by the zod schema's `.refine()`).
- **Pricing summary:** a simple bordered panel (shadcn `Card`) listing: "Chi phí Nhân viên: 0 VNĐ", one line per companion ("{fullName} ({adult|child}): {price} VNĐ"), and a bold "TỔNG TIỀN DỰ KIẾN: {total} VNĐ" line, recalculated on every form value change via `calculateTotal`.
- **Confirmation:** a shadcn `Checkbox` labeled "Tôi đã kiểm tra đầy đủ và xác nhận thông tin chính xác." — the "Xác nhận thông tin chính xác" submit button (shadcn `Button`) stays disabled until this is checked and the rest of the form validates.
- **Submit behavior:** on submit, build the `companions: Companion[]` array (generating an `id` per companion, e.g. via `crypto.randomUUID()`, and setting `type` via `classifyAge(dob)`), call `submitRegistration({ employeeId: employee.id, tourId: tour.id, transportMethod, pickupPoint, companions })`, show a submit-in-flight disabled state on the button, and on `{ ok: false }` show the returned `error` string in a shadcn `Alert` (variant destructive) without leaving the form; on `{ ok: true }` call `onSubmitted(registration)`.

- [ ] **Step 1: Install needed shadcn components and libraries**

Run: `npx shadcn@latest add radio-group select checkbox` then `npm install react-hook-form zod @hookform/resolvers`

- [ ] **Step 2: Define the zod schema and `RegistrationFormValues` type in `RegistrationFormScreen.tsx`**

```ts
import { z } from "zod";

const companionSchema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ tên"),
  dob: z.string().min(1, "Vui lòng nhập ngày sinh"),
  gender: z.enum(["male", "female"]),
  relationship: z.string().min(1, "Vui lòng nhập mối quan hệ"),
});

export const registrationFormSchema = z
  .object({
    companions: z.array(companionSchema).max(4),
    transportMethod: z.enum(["self", "tour_bus"]),
    pickupPoint: z
      .enum(["Hà Tĩnh", "Quảng Bình", "Quảng Trị", "TP. Huế", "Đà Nẵng", "Quảng Nam", "Quảng Ngãi"])
      .nullable(),
    confirmed: z.literal(true, { errorMap: () => ({ message: "Vui lòng xác nhận thông tin" }) }),
  })
  .refine((data) => data.transportMethod !== "tour_bus" || data.pickupPoint !== null, {
    message: "Vui lòng chọn điểm đón",
    path: ["pickupPoint"],
  });

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;
```

- [ ] **Step 3: Implement `PricingSummary.tsx`** — pure component per the description above, calling `classifyAge(c.dob)` per companion to label adult/child and picking the matching `tour.adultPrice`/`tour.childPrice`, summed via `calculateTotal`.

- [ ] **Step 4: Implement `CompanionFieldArray.tsx`** using `useFieldArray({ control, name: "companions" })`; compute live adult/child counts from the array's current `dob` values (via `useWatch`) to enforce the 2+2 cap on the "+ Thêm người thân" button as described.

- [ ] **Step 5: Implement `TransportSection.tsx`** using `useWatch({ control, name: "transportMethod" })` to conditionally render the pickup `Select`.

- [ ] **Step 6: Implement `RegistrationFormScreen.tsx`**, wiring `useForm({ resolver: zodResolver(registrationFormSchema), defaultValues: { companions: [], transportMethod: "self", pickupPoint: null, confirmed: false } })`, composing `CompanionFieldArray`, `TransportSection`, `PricingSummary` (fed by `useWatch({ control, name: "companions" })` cast/mapped to `Companion[]` with `classifyAge` applied for display purposes only — the real `Companion[]` with `id`/`type` is built at submit time per the Submit behavior description), the confirmation `Checkbox`, and the submit button + error `Alert`.

- [ ] **Step 7: Wire into `WizardPage.tsx`**

Render `<RegistrationFormScreen employee={employee} tour={selectedTour} onSubmitted={(registration) => { setRegistration(registration); setStep("ticket"); }} />` when `step === "register"` (guard: only reachable once `employee` and `selectedTour` are set).

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, walk through Screens 1→2→3: add companions until hitting the 2 child + 2 adult cap (verify the add button disables correctly), toggle transport method and confirm the pickup dropdown appears/disappears and is required, watch the pricing summary update live, confirm the submit button stays disabled until the checkbox is ticked, submit and confirm it advances to the ticket step placeholder. Repeat this walkthrough at a ~375px mobile viewport (browser dev tools device toolbar) to confirm all fields, buttons, and the pricing summary remain fully visible and usable without horizontal scrolling. Then re-run the flow selecting the seeded full Nha Trang tour and confirm the submit shows the "Tour đã đầy" error (this can only be reached by temporarily allowing selection of a full tour's card in `TourSelectionScreen`, since Task 5 already disables that button — verify this rejection path directly via a temporary `submitRegistration` call in the browser console instead if the UI path is blocked, then remove the console test).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: implement registration form with companions, transport, and pricing"
```

---

### Task 7: Screen 4 — Event ticket (with Less styling and PNG download)

**Files:**
- Create: `src/components/ticket/EventTicket.tsx`
- Create: `src/components/ticket/ticket.less`
- Create: `src/components/wizard/TicketScreen.tsx`
- Modify: `src/pages/WizardPage.tsx` (render `TicketScreen` for the `"ticket"` step)

**Interfaces:**
- Consumes: `Employee`, `Tour`, `Registration` types from Task 2; `getTourById` from `src/lib/mockData.ts`.
- Produces: `TicketScreen` props `{ employee: Employee; registration: Registration }` (looks up the tour internally via `getTourById(registration.tourId)`, so `WizardPage` doesn't need to separately track it for this step). `EventTicket` props `{ employee: Employee; tour: Tour; registration: Registration }` — a presentational component wrapping the ticket DOM in a ref-forwarded container (`forwardRef<HTMLDivElement, EventTicketProps>`) so `TicketScreen` can pass that ref to `html-to-image`.

**What the ticket needs (per `requirements.md` §2.4 mock layout):**
- Brand logos row at the top (placeholder logo images/text for now: "TGDD | DMX | TopZone | An Khang | EraBlue").
- Title block: "VÙNG HNO+" and "VÉ MỜI SỰ KIỆN 2026".
- Employee's full name, prominently displayed.
- An info table/panel with rows: "Mã số Nhân viên" → `employee.id`, "Bộ phận" → `employee.department`, "Siêu thị" → `employee.store`, "Tên Tour" → `tour.name`, "Ngày khởi hành" → `tour.startDate`, "Địa điểm đón" → `registration.pickupPoint ?? "Tự túc"`.
- A tagline block with the 3 marketing lines from the mock ("VƯỢT ĐỈNH IPO VƯƠN TẦM KHU VỰC", "MỖI NĂM VƯỢT TRỘI", "5 NĂM NHÂN ĐÔI GIÁ TRỊ") and the closing welcome sentence.
- Below the ticket: a "Tải ảnh vé (.png)" button (shadcn `Button`) that captures the ticket ref via `html-to-image`'s `toPng()` and triggers a browser download named `ve-moi-{employee.id}.png`.
- `ticket.less` handles the ticket's card border, background gradient/color blocking, and the internal info-table grid layout (rows with label/value columns) — the pieces that are awkward to express as pure Tailwind utility strings; everything else on the page (button, spacing around the card) stays Tailwind. The ticket must render legibly on a ~375px-wide mobile viewport (this is also important because `html-to-image` captures the ticket at its rendered DOM size, so the exported PNG should look correct at mobile widths, not just desktop) — use `max-width: 100%` and fluid units inside `ticket.less` rather than fixed desktop-only pixel widths.

- [ ] **Step 1: Install `html-to-image`**

Run: `npm install html-to-image`

- [ ] **Step 2: Write `src/components/ticket/ticket.less`**

Define classes `.event-ticket`, `.event-ticket__logos`, `.event-ticket__title`, `.event-ticket__info-table`, `.event-ticket__info-row`, `.event-ticket__tagline` implementing the visual structure described above (border, padding, background, grid/flex rows for the info table with label/value alignment). Use Less nesting for the info table row structure, e.g.:
```less
.event-ticket {
  border: 2px solid #1e3a8a;
  border-radius: 12px;
  padding: 24px;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);

  &__info-table {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 8px;

    .event-ticket__info-row {
      display: contents;

      dt {
        font-weight: 600;
        color: #1e3a8a;
      }
    }
  }
}
```

- [ ] **Step 3: Implement `EventTicket.tsx`** as a `forwardRef` component rendering the structure described above, importing `./ticket.less` and applying its class names, using Tailwind only for outer spacing/centering.

- [ ] **Step 4: Implement `TicketScreen.tsx`**

Looks up `getTourById(registration.tourId)` (guard against `undefined` by rendering nothing/an error state if missing — should not happen in practice since the tour existed at submit time). Holds a `useRef<HTMLDivElement>(null)`, renders `<EventTicket ref={ticketRef} employee={employee} tour={tour} registration={registration} />`, and a download button with an `onClick` handler:
```ts
import { toPng } from "html-to-image";

async function handleDownload() {
  if (!ticketRef.current) return;
  const dataUrl = await toPng(ticketRef.current);
  const link = document.createElement("a");
  link.download = `ve-moi-${employee.id}.png`;
  link.href = dataUrl;
  link.click();
}
```

- [ ] **Step 5: Wire into `WizardPage.tsx`**

Render `<TicketScreen employee={employee} registration={registration} />` when `step === "ticket"` (guard: only reachable once `employee` and `registration` are set).

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, complete the full flow to the ticket screen, confirm the layout matches the mock's structure (logos row, title, name, info table, tagline), click "Tải ảnh vé (.png)" and confirm a PNG file downloads with the correct filename and visually matches the on-screen ticket. Repeat at a ~375px mobile viewport and confirm the ticket card stays within the screen width (no overflow) and the downloaded PNG still looks correct when captured at that width. Also verify the "already registered" path from Task 4 (re-enter an MSNV with an existing mock registration) lands directly on this same ticket screen with correct data.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: implement event ticket screen with PNG download"
```

---

### Task 8: Admin page — login, employee import, tour config, registrations export

**Files:**
- Create: `src/components/admin/AdminLoginForm.tsx`
- Create: `src/components/admin/AdminLayout.tsx`
- Create: `src/components/admin/EmployeeImportPanel.tsx`
- Create: `src/components/admin/TourConfigTable.tsx`
- Create: `src/components/admin/RegistrationsTable.tsx`
- Modify: `src/pages/AdminPage.tsx` (replace the Task 3 stub)
- Modify: `src/lib/mockData.ts` (add admin-facing helpers)

**Interfaces:**
- Consumes: `Employee`, `Tour`, `Registration` types from Task 2; tour/registration accessors from `src/lib/mockData.ts`.
- Produces:
  - New `src/lib/mockData.ts` exports: `getAllTours(): Tour[]`, `getAllRegistrationsWithDetails(): Array<Registration & { employee: Employee; tour: Tour }>`, `updateTourConfig(tourId: string, changes: Partial<Pick<Tour, "maxCapacity" | "adultPrice" | "childPrice">>): void`, `importEmployees(rows: Array<Omit<Employee, never>>): { imported: number; errors: Array<{ row: number; message: string }> }` (validates each row has non-empty `id`/`fullName`/`department`/`store` and `destination` is `"da_lat" | "nha_trang"`, skips invalid rows, upserts valid ones by `id`).
  - `AdminPage` owns `isAuthenticated: boolean` state (mock-only: a hardcoded local check, e.g. comparing an entered password against a hardcoded string constant `MOCK_ADMIN_PASSWORD = "admin123"` defined at the top of `AdminPage.tsx` — a code comment notes this is replaced by the real `ADMIN_PASSWORD` env-var-backed serverless check in the backend-wiring plan). Renders `AdminLoginForm` when false, `AdminLayout` when true.
  - `AdminLoginForm` props `{ onLoginSuccess: () => void }`.
  - `AdminLayout` props `{ children }` — renders a tab bar (shadcn `Tabs`: "Nhân viên" / "Cấu hình Tour" / "Danh sách đăng ký") and renders the corresponding panel component per tab.

**What each panel needs:**
- **`EmployeeImportPanel`:** a file input accepting `.xlsx`, a "Import" button that parses the file with the `xlsx` library (`read`/`utils.sheet_to_json`) into rows matching columns MSNV/Họ tên/Bộ phận/Siêu thị/Điểm đến, maps them to `Omit<Employee, never>`-shaped objects, calls `importEmployees(rows)`, and displays a summary ("Đã import {imported} nhân viên") plus a list of any per-row errors returned.
- **`TourConfigTable`:** a shadcn `Table` listing all 5 tours (via `getAllTours()`) with editable `Input` cells for `maxCapacity`, `adultPrice`, `childPrice` per row, and a "Lưu" button per row that calls `updateTourConfig(tour.id, { maxCapacity, adultPrice, childPrice })` and shows a brief success toast/inline confirmation. Wrap the table in a horizontally scrollable container (Tailwind `overflow-x-auto`) so it stays usable on narrow mobile screens without breaking layout.
- **`RegistrationsTable`:** a shadcn `Table` listing all registrations (via `getAllRegistrationsWithDetails()`) with columns: MSNV, Họ tên, Tour, Số người lớn đi kèm, Số trẻ em đi kèm, Tổng tiền, Ngày đăng ký. An "Xuất Excel" button that uses the `xlsx` library (`utils.json_to_sheet` + `writeFile`) to generate and download an `.xlsx` file client-side from the same data (mock-only client-side export for now; the backend-wiring plan moves this behind a serverless function using the service-role key, per the spec). Also wrap this table in `overflow-x-auto` for mobile usability.

- [ ] **Step 1: Install `xlsx` and shadcn table/tabs components**

Run: `npm install xlsx` then `npx shadcn@latest add table tabs`

- [ ] **Step 2: Add admin helpers to `src/lib/mockData.ts`** per the exact signatures listed in Interfaces above.

- [ ] **Step 3: Implement `AdminLoginForm.tsx`** — password `Input` (type="password") + "Đăng nhập" `Button`, compares against `MOCK_ADMIN_PASSWORD` passed in as a prop or imported constant, shows an inline error `Alert` on mismatch, calls `onLoginSuccess()` on match.

- [ ] **Step 4: Implement `EmployeeImportPanel.tsx`** per the description above.

- [ ] **Step 5: Implement `TourConfigTable.tsx`** per the description above.

- [ ] **Step 6: Implement `RegistrationsTable.tsx`** per the description above.

- [ ] **Step 7: Implement `AdminLayout.tsx`** composing the three panels under shadcn `Tabs`.

- [ ] **Step 8: Implement `AdminPage.tsx`**, replacing the Task 3 stub, wiring `isAuthenticated` state and rendering `AdminLoginForm`/`AdminLayout` as described.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`, visit `/admin`, confirm the login form blocks access until the correct mock password is entered. After login: build a small test `.xlsx` file with columns MSNV/Họ tên/Bộ phận/Siêu thị/Điểm đến (include one intentionally invalid row, e.g. missing MSNV) and confirm the import panel reports correct imported count and the row error. Edit a tour's capacity/pricing in `TourConfigTable`, save, and confirm the change persists (e.g. by switching tabs and back, or by checking the wizard's Screen 2 reflects the new capacity). Submit at least one registration via the wizard flow, then confirm it appears in `RegistrationsTable`, and click "Xuất Excel" to confirm a valid `.xlsx` downloads and opens with correct columns/data.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: implement admin page with employee import, tour config, and registrations export"
```

---

## Self-Review Notes

**Spec coverage:**
- Screen 1 (MSNV validation, exact error copy, valid→Screen 2) → Task 4. ✓
- Screen 2 (Đà Lạt 1 card, Nha Trang 4 cards, capacity badge, PDF link, already-registered→ticket shortcut) → Tasks 3–5. ✓
- Screen 3 (companions max 2+2, age auto-classification, transport + 7 pickup points, live pricing, confirmation gate) → Task 6. ✓
- Screen 4 (ticket layout matching mock, PNG download) → Task 7. ✓
- Admin: login, employee Excel import, tour capacity/pricing config, registrations view + Excel export → Task 8. ✓
- Tailwind design tokens + Less for the ticket → Tasks 1 & 7. ✓
- Mobile-first responsive design (primary usage is mobile) → Global Constraints + explicit mobile-viewport checks in Tasks 5, 6, 7, 8. ✓
- UI-only scope (mock data, no real Supabase/serverless calls) → enforced throughout via `src/lib/mockData.ts` as the single seam. ✓

**Placeholder scan:** no "TBD"/"TODO"/"handle edge cases" phrasing found; every step has concrete code, exact copy strings, or a fully described UI structure per the user's request to keep UI descriptions at the "what's in the view" level rather than full JSX.

**Type consistency:** `Employee`, `Tour`, `Companion`, `Registration`, `TransportMethod`, `PickupPoint` are defined once in Task 2 and referenced identically by name in Tasks 3–8; `submitRegistration`'s input/output shape (Task 2) matches exactly how it's called in Task 6 Step 6; `getTourById`/`getAllTours`/`getAllRegistrationsWithDetails`/`updateTourConfig`/`importEmployees` signatures declared in Task 2/8 are used consistently in Tasks 5, 7, and 8 with no renaming drift.
