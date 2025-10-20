# Implementation Plan: OR Waiting List & Scheduling

**Branch**: `001-project-or-waiting` | **Date**: 2025-10-02 | **Spec**: `specs/001-project-or-waiting/spec.md`
**Input**: Feature specification from `/specs/001-project-or-waiting/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
	→ If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
	→ Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
	→ Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
	→ If violations exist: Document in Complexity Tracking
	→ If no justification possible: ERROR "Simplify approach first"
	→ Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
	→ If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
7. Re-evaluate Constitution Check section
	→ If new violations: Refactor design, return to Phase 1
	→ Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

## Summary
The MVP delivers a Kanban-style waiting list beside a weekly/monthly OR calendar with consistent color coding. Coordinators import Excel files via a mapping wizard, creating backlog cards (name + MRN). Scheduling occurs by drag-and-drop or a confirm dialog capturing OR room, surgeon, duration, and notes. Scheduled items appear as colored calendar blocks; clicking any card/block opens detail dialogs. Standard exports (PDF/Excel) include name (with masked MRN), case type, procedure, room, start–end, and surgeon. Optimistic concurrency governs edits; accessibility follows the Local Team Standard.

## Technical Context
**Language/Version**: NEEDS CLARIFICATION  
**Primary Dependencies**: NEEDS CLARIFICATION  
**Storage**: NEEDS CLARIFICATION  
**Testing**: NEEDS CLARIFICATION  
**Target Platform**: Desktop web browsers  
**Project Type**: web (UI + data/services)  
**Performance Goals**: NEEDS CLARIFICATION  
**Constraints**: Keep interactions under minimal clicks; maintain responsive UI; adhere to Local Team Accessibility Standard  
**Scale/Scope**: NEEDS CLARIFICATION

## Constitution Check
Initial review indicates alignment with principles: user-value focus, clear acceptance, accessibility considerations, and auditability. No violations identified at this stage. Will re-check post-design.

## Project Structure

### Documentation (this feature)
```
specs/001-project-or-waiting/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── models/
├── services/
├── ui/
└── lib/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Single-project structure for MVP (src + tests). Can evolve to split frontend/backend if needed.

## Phase 0: Outline & Research
1. Unknowns from Technical Context (create research tasks):
	- Turnaround/buffer policy for OR scheduling
	- Role model and permissions granularity
	- Source-of-truth systems for patients/surgeons/procedures
	- Import limits (max file size/rows) and locale defaults (dates/numbers)
	- Keyboard shortcut scheme (alignment with Local Team standard)
	- Performance/scale targets (users/day, schedule size)
2. Dispatch research agents (document rationale & alternatives in research.md).
3. Output: research.md consolidates decisions; unresolved items tracked for next clarify cycle if necessary.

## Phase 1: Design & Contracts
1. Data Model (data-model.md): Entities and relationships from the spec; include dedup key (Name+MRN), category changes via Kanban, audit logging, optimistic concurrency notes.
2. API Contracts (contracts/): Define endpoints for import, backlog, schedule, exports.
3. Contract Tests (tests/contract): One file per endpoint (skeletons now; fail until implemented).
4. Test Scenarios (quickstart.md): Map primary user journeys to step-by-step validation.
5. Update agent file: `.specify/scripts/bash/update-agent-context.sh copilot` (append new tech decisions only).

## Phase 2: Task Planning Approach (NOT executed here)
- Generate tasks from contracts, data model, and quickstart using `.specify/templates/tasks-template.md`.
- TDD order: contract tests → models → services → UI; mark [P] for parallelizable work.
- Expect ~25–30 tasks in tasks.md.

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| — | — | — |

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research scaffolding created (/plan command)
- [x] Phase 1: Design scaffolding created (/plan command)
- [ ] Phase 2: Task planning complete (/plan describes approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
