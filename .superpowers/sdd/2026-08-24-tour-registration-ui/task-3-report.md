# Task 3 Report — Routing shell and wizard layout

## What I did

1. Installed React Router for route handling:
   - `react-router-dom@^7.18.2`

2. Added the shared wizard shell:
   - `src/components/wizard/WizardLayout.tsx`
   - Full-height, mobile-first centered shell
   - Shared banner title: `Tour Du Lịch Vùng Trung Bộ 2026`
   - Centered card slot via `{children}` for later step screens

3. Added the wizard page state owner:
   - `src/pages/WizardPage.tsx`
   - Exported `WizardStep` union: `"welcome" | "tours" | "register" | "ticket"`
   - Exported `WizardStepProps` contract for later step components
   - Internal state held with `useState` for:
     - `currentStep`
     - `employee`
     - `selectedTour`
     - `registration`
   - Placeholder render shows the current step name inside `WizardLayout`

4. Added the admin stub page:
   - `src/pages/AdminPage.tsx`
   - Stub text only: `Admin page (coming in Task 8)`

5. Wired routing:
   - `src/main.tsx` wraps `<App />` in `<BrowserRouter>`
   - `src/App.tsx` defines:
     - `/` → `WizardPage`
     - `/admin` → `AdminPage`

## Exact component / prop signatures

- `src/components/wizard/WizardLayout.tsx`
  - `interface WizardLayoutProps { children: ReactNode }`
  - `function WizardLayout({ children }: WizardLayoutProps)`

- `src/pages/WizardPage.tsx`
  - `export type WizardStep = 'welcome' | 'tours' | 'register' | 'ticket'`
  - `export interface WizardStepProps {`
    - `currentStep: WizardStep`
    - `employee: Employee | null`
    - `selectedTour: Tour | null`
    - `registration: Registration | null`
    - `onEmployeeVerified: (employee: Employee) => void`
    - `onTourSelected: (tour: Tour) => void`
    - `onRegistrationSubmitted: (registration: Registration) => void`
    - `onStepChange: (step: WizardStep) => void`
    - `}`
  - `function WizardPage()`

- `src/pages/AdminPage.tsx`
  - `function AdminPage()`

- `src/App.tsx`
  - `function App()`

## Deviations from the brief

- None functionally.
- I included an exported `WizardStepProps` interface plus an `onStepChange` callback in `WizardPage` to make Tasks 4–7 easier to wire into the existing page-state owner. This is additive and does not change the approved routing shape.

## Commands run

- `npm install react-router-dom`
- `npm run build`
- `npm run dev -- --host 127.0.0.1`
- `npx --yes playwright install chromium`
- `npx --yes playwright screenshot --browser chromium --viewport-size 375,812 http://127.0.0.1:5173/ ./playwright-root.png`
- `npx --yes playwright screenshot --browser chromium --viewport-size 375,812 http://127.0.0.1:5173/admin ./playwright-admin.png`
- `git log --oneline -3`

## Verification

- `npm run build` ✅ passed.
- Mobile viewport check at ~375px width ✅
  - `/` rendered the wizard shell and the placeholder step text with no horizontal overflow.
  - `/admin` rendered the admin stub inside a centered card with no horizontal overflow.

## Git

- Commit: `380c75d` — `feat: add routing shell and wizard layout`
- `git log --oneline -3`:
  - `380c75d feat: add routing shell and wizard layout`
  - `0179081 fix: handle unknown tour in registration`
  - `e48d410 feat: add domain types, mock data, and pricing logic`

## Fix Round 1

- Changed `react-router-dom` from `^7.18.2` to `^6.30.6` in `package.json`.
- Ran `npm install` to refresh `package-lock.json` for the v6 dependency tree.
- Verified routing code still uses the v6-compatible `BrowserRouter`, `Routes`, and `Route` APIs; no `createBrowserRouter`/`RouterProvider` usage exists.
- Confirmed the app still builds with `npm run build`.
- Confirmed the dev server runs with `npm run dev -- --host 127.0.0.1` and both `/` and `/admin` render in Chromium at `http://127.0.0.1:5174/` and `http://127.0.0.1:5174/admin`.
- Commit: `fce553d` — `fix: pin react router to v6`
