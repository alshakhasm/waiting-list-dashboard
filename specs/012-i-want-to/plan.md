# Implementation Plan: Card Roller Tab

**Branch**: `012-i-want-to` | **Date**: 2025-10-08 | **Spec**: specs/012-i-want-to/spec.md
**Input**: Feature specification from `/specs/012-i-want-to/spec.md`

## Summary
A new Card Roller tab will present one backlog item at a time with full patient details and Up/Down keyboard navigation. Navigation stops at list ends. The view requires selecting a category first and iterates items of that category in chronological order (oldest→newest). Cards expose quick actions (Edit, Schedule, Remove) with position preservation rules.

## Technical Context
**Language/Version**: TypeScript, React 18 (Vite)
**Primary Dependencies**: react, supabase-js (existing), internal UI modules
**Storage**: Supabase tables already used for backlog
**Testing**: Jest (repo), lightweight React tests optional in Phase 1
**Target Platform**: Web (Vite dev/build)
**Project Type**: Web single app (apps/ui)
**Performance Goals**: Sub-50ms navigation latency per card (cached in memory)
**Constraints**: Must respect RLS; actions mirror existing capabilities
**Scale/Scope**: Up to thousands of backlog items; paging not required for v1

## Constitution Check
No violations anticipated; remains within existing web app and data models.

## Project Structure

### Documentation (this feature)
```
specs/012-i-want-to/
├── plan.md
├── research.md          # created in Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2
```

### Source Code (repository root)
```
apps/ui/src/ui/
├── CardRollerPage.tsx          # new tab view
├── CardRollerCard.tsx          # presentational card component
├── App.tsx                     # add nav entry + route
└── ... (reuse Backlog APIs)
```

**Structure Decision**: Extend the existing web app (apps/ui) with two new UI components and minimal wiring in `App.tsx`.

## Phase 0: Outline & Research
1. Unknowns to confirm: edit/schedule/remove UX affordances within card; keyboard focus handling; accessibility labels.
2. Best practices: one-item viewer patterns, keyboard nav, focus trapping avoidance.
3. Output: `research.md` summarizing decisions and patterns for the above.

## Phase 1: Design & Contracts
1. Data model: Reuse BacklogItem fields; define Card props and NavigationContext in `data-model.md`.
2. Contracts: Document UI contracts (props, callbacks) in `/contracts/` as MD with example JSON payload shapes.
3. Tests: Add a basic Jest test to assert nav boundary conditions and action callbacks (failing initially).
4. Quickstart: Steps to run the Card Roller and verify navigation/actions.
5. Update agent context: Run `.specify/scripts/bash/update-agent-context.sh copilot`.

## Phase 2: Task Planning Approach
- Generate tasks from Phase 1 artifacts; TDD-first ordering; parallelize independent UI units.

## Complexity Tracking
None at this time.

## Progress Tracking
**Phase Status**:
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented
