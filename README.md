# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Backend setup (Supabase + Vercel)

This app is wired to a real Supabase (Postgres) backend and Vercel serverless
functions under `api/`. See
`docs/superpowers/specs/2026-08-25-supabase-backend-wiring-design.md` for the
full design.

1. **Run the migration** — apply `supabase/migrations/0001_init.sql` against
   your Supabase project (SQL editor, or `supabase db push` if you have the
   CLI linked). It creates the schema, RLS policies, RPC functions, enables
   Realtime on `tours`, and seeds the 5 tour rows.
2. **Copy env vars** — `cp .env.example .env.local` and fill in:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — from Supabase
     Project Settings → API (anon/publishable key, safe for the browser).
   - `SUPABASE_SERVICE_ROLE_KEY` — from the same page (server-only, never
     ships to the client bundle).
   - `ADMIN_PASSWORD` — the password checked by `/api/admin/login`.
   - `ADMIN_SESSION_SECRET` — any long random string used to HMAC-sign the
     admin session cookie.
3. **Local dev with serverless functions** — use `vercel dev` (not `vite dev`)
   so the `/api/*` routes run alongside the frontend:
   ```sh
   npm i -g vercel   # if not already installed
   vercel link       # link this repo to a Vercel project
   vercel dev
   ```
4. **Deploy** — push the linked Vercel project and set the same 5 env vars
   in the Vercel dashboard (Production + Preview).
5. Import employees via the admin panel (`/admin`) before testing the
   wizard end-to-end — the `employees` table starts empty.
