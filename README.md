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

// Create a mapping profile
await handleRequest({ method: 'POST', path: '/mapping-profiles', body: { name: 'Default', owner: 'ops', fieldMappings: { A: 'a' } } });

// Import rows and list backlog
await handleRequest({ method: 'POST', path: '/imports/excel', body: { fileName: 'seed.xlsx', rows: [ { patientName: 'A', mrn: '1', procedure: 'Proc', estDurationMin: 30 } ] } });
const backlog = await handleRequest({ method: 'GET', path: '/backlog' });
```

Routes supported: GET/POST mapping profiles, POST imports, GET backlog, POST/PATCH/DELETE schedule, GET exports/schedule, GET legend.

## UI app (Vite + React)
UI lives under `apps/ui`. To run it locally:

```bash
# install UI deps
cd apps/ui && npm install

# start dev server
npm run dev
```

The app calls the in-process adapter directly, so no backend server is required.

