# OR Waiting List & Scheduling

[![CI](https://github.com/alshakhasm/waiting-list-dashboard/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alshakhasm/waiting-list-dashboard/actions/workflows/ci.yml)

This repository contains the OR waiting list (Kanban) and scheduling calendar MVP. See `specs/001-project-or-waiting/spec.md` for the feature specification.

## Development
- Tasks: `specs/001-project-or-waiting/tasks.md`
- Plan: `specs/001-project-or-waiting/plan.md`
- Contracts: `specs/001-project-or-waiting/contracts/README.md`

## In-process HTTP adapter
A thin REST-like adapter is available for UI wiring and tests. Import `handleRequest` and issue requests like you would to an HTTP server, but in-memory:

```ts
import { handleRequest } from './src';

// Import rows and list backlog
await handleRequest({ method: 'POST', path: '/imports/excel', body: { fileName: 'seed.xlsx', rows: [ { patientName: 'A', mrn: '1', procedure: 'Proc', estDurationMin: 30 } ] } });
const backlog = await handleRequest({ method: 'GET', path: '/backlog' });
```

Routes supported: POST imports, GET backlog, POST/PATCH/DELETE schedule, GET exports/schedule, GET legend.

## UI app (Vite + React)
UI lives under `apps/ui`. To run it locally:

```bash
# install UI deps
cd apps/ui && npm install

# start dev server
npm run dev
```

The app calls the in-process adapter directly, so no backend server is required.

## Enable Supabase auth (Step 1)
If you want real authentication and persistence via Supabase (optional for local dev), set these env vars for the UI:

- Create a Supabase project (free tier is fine) at https://supabase.com/
- In Supabase → Project Settings → API, copy:
	- Project URL → VITE_SUPABASE_URL
	- anon public key → VITE_SUPABASE_ANON_KEY
- In `apps/ui/.env.local` (create it if missing), add:
	- `VITE_SUPABASE_URL=...`
	- `VITE_SUPABASE_ANON_KEY=...`

Notes
- Do not commit real keys. `.gitignore` already excludes `apps/ui/.env*`.
- When building for deployment (GitHub Pages or otherwise), ensure those env vars are set so Supabase auth works in production.
- An example file exists at `apps/ui/.env.example`.
- Full schema, RLS policies, and auth configuration are in `SUPABASE.md`.
 - The UI shows an EnvDebug badge with `/?debug=1` indicating if Supabase is enabled.

Verify locally
- Restart the dev server after setting env.
- In the browser console, you should NOT see a warning like `[Supabase] Disabled — missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY`.
- The header Sign in menu will include Magic Link/Reset options when Supabase is enabled.
 - If profile loading times out, an error screen appears with Retry, Become owner now, and Go to Sign in.

## Account flows

- Create Account (owner): visit `/?create=1`, fill details, confirm email; after signing in, your owner row is created automatically. If not, use the error screen’s “Become owner now”.
- Sign in: `/?signin=1` supports email + password and magic link.
- Accept invite: `/?accept=1&token=...` links add you as a pending member; the owner approves in Members.


## Deploying to GitHub Pages with Supabase

This repo includes a Pages workflow that builds the UI (`apps/ui`) and deploys to GitHub Pages.

Prereqs
- Supabase project URL and anon key (Project Settings → API)
- GitHub repository permissions to create environment secrets

Steps
1. In GitHub → Settings → Environments → create or open `preview`.
2. Add secrets:
	 - `VITE_SUPABASE_URL` = `https://YOUR-REF.supabase.co`
	 - `VITE_SUPABASE_ANON_KEY` = anon public key
3. In Supabase → Authentication → URL Configuration:
	 - Site URL: `https://<user>.github.io/waiting-list-dashboard/`
	 - Redirect URLs:
		 - `https://<user>.github.io/waiting-list-dashboard/`
		 - `https://<user>.github.io`
4. Push to `main` or run the Pages workflow manually.

How it works
- The workflow writes `apps/ui/.env` from the secrets before `vite build`.
- Vite uses a relative base so assets load under the repo subpath.

Verify
- Open `https://<user>.github.io/waiting-list-dashboard/?debug=1` and in DevTools console run:
	- `window.__SUPABASE_DEBUG__` → should show `hasUrl: true`, `hasAnon: true`.
- The UI footer shows the deploy commit and time.

Troubleshooting
- "Authentication not configured": ensure secrets exist in the `preview` environment.
- Magic link issues: double‑check Site URL and Redirect URLs (exact, https, trailing slash).


<!-- ci: pages ping 2025-10-11 -->
