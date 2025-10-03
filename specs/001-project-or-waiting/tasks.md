# Tasks: OR Waiting List & Scheduling

Input: spec.md, plan.md, data-model.md, contracts/ for this feature
Branch: 001-project-or-waiting

Assumptions (adjust if different):
- Single-project repo with src/ and tests/ at the root per plan.md
- TypeScript/Node for services and API (Express-like), Jest for tests, React for UI; update extensions/configs if stack differs
- Paths and filenames below are suggestions to keep work organized and parallelizable

Rules of engagement:
- TDD-first: write tests that fail before implementing endpoints/services/models/UI
- Mark [P] if the task can run in parallel (different files, no ordering dependency)
- Keep tasks atomic; commit after each

## Phase 3.1: Setup
1) T001 Create baseline project folders and scaffolding
   - Create: src/models/, src/services/, src/api/, src/ui/, src/lib/
   - Create: tests/contract/, tests/integration/, tests/unit/, tests/performance/
   - Add .editorconfig and README badges section

2) T002 Initialize toolchain per Technical Context (stack)
   - If TS/Node: package.json, tsconfig.json, jest.config.ts, .nvmrc
   - Add npm scripts: test, test:watch, lint, format, typecheck

3) T003 [P] Configure linting/formatting and a11y/test rules
   - .eslintrc.json with TS + jest + jsx-a11y, .prettierrc, .lintstagedrc

4) T004 [P] Add CI workflow to run tests and lint
   - .github/workflows/ci.yml running install → lint → test

## Phase 3.2: Tests First (Contracts + Journeys)
Write these tests to FAIL before implementation.

Contract tests (one per endpoint):
5) T005 [P] Contract test: POST /imports/excel
   - File: tests/contract/imports_excel.test.ts
   - Asserts: 202 accepted + import batch id; dedup behavior noted

6) T006 [P] Contract test: GET /mapping-profiles
   - File: tests/contract/mapping_profiles_get.test.ts
   - Asserts: 200 + array schema

7) T007 [P] Contract test: POST /mapping-profiles
   - File: tests/contract/mapping_profiles_post.test.ts
   - Asserts: 201 + persisted profile

8) T008 [P] Contract test: GET /backlog
   - File: tests/contract/backlog_get.test.ts
   - Asserts: filtering by caseType/surgeon/search; PHI masked

9) T009 [P] Contract test: POST /schedule
   - File: tests/contract/schedule_post.test.ts
   - Asserts: validations (room availability, surgeon availability), creates entry

10) T010 [P] Contract test: PATCH /schedule/{id}
    - File: tests/contract/schedule_patch.test.ts
    - Asserts: optimistic concurrency on version; 409 on conflict

11) T011 [P] Contract test: DELETE /schedule/{id}
    - File: tests/contract/schedule_delete.test.ts
    - Asserts: cancels entry; idempotent

12) T012 [P] Contract test: GET /exports/schedule
    - File: tests/contract/exports_schedule_get.test.ts
    - Asserts: 200 + file, includes required columns, MRN masked

13) T013 [P] Contract test: GET /legend
    - File: tests/contract/legend_get.test.ts
    - Asserts: 200 + case type to color map

Integration tests (primary journeys):
14) T014 [P] Journey: Excel import → backlog items created with dedup
    - File: tests/integration/import_to_backlog.test.ts

15) T015 [P] Journey: Create schedule entry and reflect in calendar data
    - File: tests/integration/schedule_create_flow.test.ts

16) T016 [P] Journey: Concurrency conflict on update prompts resolution path
    - File: tests/integration/schedule_conflict_resolution.test.ts

17) T017 [P] Journey: Weekly export contains standard fields with masked MRN
    - File: tests/integration/export_weekly.test.ts

18) T018 [P] Unit: ScheduleEntry versioning and conflict detection behavior
    - File: tests/unit/schedule_entry_versioning.test.ts

## Phase 3.3: Data Models
19) T019 [P] Models: WaitingListItem and CaseType
    - Files: src/models/waitingListItem.ts, src/models/caseType.ts
    - Include: fields from data-model.md; audit hooks placeholders

20) T020 [P] Models: ORRoom and Surgeon
    - Files: src/models/orRoom.ts, src/models/surgeon.ts
    - Include: capabilities/availability placeholders

21) T021 [P] Model: ScheduleEntry with version and status
    - File: src/models/scheduleEntry.ts
    - Include: version increment helpers; status enum

22) T022 [P] Models: MappingProfile, ImportBatch, ExportArtifact
    - File: src/models/mapping.ts
    - Include: field_mappings schema; counts and errors shape

## Phase 3.4: Services and API Endpoints
23) T023 Implement ImportService + POST /imports/excel
    - Files: src/services/importService.ts, src/api/imports.ts
    - Behavior: apply mapping, dedup on (patient_name, mrn), create ImportBatch

24) T024 Implement MappingProfileService + GET/POST /mapping-profiles
    - Files: src/services/mappingProfileService.ts, src/api/mappingProfiles.ts

25) T025 Implement BacklogService + GET /backlog with filters and PHI masking
    - Files: src/services/backlogService.ts, src/api/backlog.ts

26) T026 Implement ScheduleService + POST/PATCH/DELETE /schedule
    - Files: src/services/scheduleService.ts, src/api/schedule.ts
    - Include: validations (room/surgeon availability), optimistic concurrency (version)

27) T027 Implement ExportService + GET /exports/schedule (pdf|xlsx)
    - Files: src/services/exportService.ts, src/api/exports.ts

28) T028 Implement LegendService + GET /legend
    - Files: src/services/legendService.ts, src/api/legend.ts

29) T029 [P] Add AuditLogService and wire to category/schedule mutations
    - File: src/services/auditLogService.ts
    - Hook in BacklogService and ScheduleService

## Phase 3.5: UI Components (MVP)
30) T030 [P] KanbanBoard (columns by CaseType) with keyboard alternatives
    - Files: src/ui/KanbanBoard.tsx, tests/unit/ui/kanban_a11y.test.ts
    - Include: color legend badges; non-color indicators

31) T031 [P] CalendarView (week/month) with keyboard move support
    - Files: src/ui/CalendarView.tsx, tests/unit/ui/calendar_interactions.test.ts
    - Include: consistent colors; drag-and-drop adapter

32) T032 [P] MappingWizard and ExportMenu components
    - Files: src/ui/MappingWizard.tsx, src/ui/ExportMenu.tsx, tests/unit/ui/import_export.test.ts
    - Include: field mapping validations; export parameters form

## Phase 3.6: Polish and Docs
33) T033 Performance budget tests and basic profiling hooks
    - Files: tests/performance/schedule_render.perf.test.ts, src/lib/perf.ts
    - Goal: keep interactions responsive per plan (update when targets defined)

34) T034 Update developer docs and contracts with final schemas
    - Files: specs/001-project-or-waiting/quickstart.md, specs/001-project-or-waiting/contracts/README.md

---

Dependencies (must respect order):
- Contract tests (T005–T013) BEFORE corresponding API implementations (T023–T028)
- Data models (T019–T022) BEFORE services (T023–T029)
- Integration tests (T014–T017) should be written BEFORE endpoint/service implementation they exercise
- UI components (T030–T032) AFTER services exist; their unit tests can be stubbed first

Parallelizable examples:
- Run T005–T013 in parallel (distinct test files, separate endpoints)
- Run model tasks T019–T022 in parallel (distinct files)
- UI tasks T030–T032 in parallel (distinct components/tests)

Validation checklist (gate before implementation sign-off):
- All endpoints have a contract test and an implementation task
- All entities in data-model.md have corresponding model tasks
- Tests existed and failed prior to implementation for each area (TDD respected)
- [P]-marked tasks do not modify the same files
- Accessibility: keyboard alternatives and high-contrast verified by tests (kanban_a11y, calendar_interactions)
- Export includes required fields with masked MRN
