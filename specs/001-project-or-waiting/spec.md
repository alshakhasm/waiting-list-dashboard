# Feature Specification: OR Waiting List & Scheduling

**Feature Branch**: `001-project-or-waiting`  
**Created**: 2025-10-02  
**Status**: Draft  
**Input**: User description: "Project: OR Waiting List & Scheduling\nThis project is a split-view application designed to triage surgical waiting lists and schedule cases directly into an operating room calendar. Its main purpose is to provide a clean, at-a-glance view of the backlog grouped by case type on one side, and a color-coded OR schedule on the other, with minimal clicks required to reveal full details.\n\nAdditional details: A typical workflow begins with importing an Excel file. The system maps spreadsheet columns into patient records, automatically assigning them to case categories such as Minor, Biopsy, Pathology, or Orthognathic. On the dashboard, patients appear as small cards showing only name and MRN, ordered by date of entry. These cards can be dragged onto a specific calendar day or confirmed via a checkbox that opens a scheduling dialog. Once scheduled, the patient card disappears from the backlog and reappears as a colored block in the OR calendar. Clicking any scheduled block reopens full details for review or editing. Coordinators can also export a daily or weekly schedule to PDF or Excel for circulation.\n\nMVP emphasis: Kanban-style waiting list beside a weekly or monthly calendar; Kanban columns represent case categories; color-coding consistent across both views; Excel import with mapping wizard; scheduling by drag-and-drop or confirm-box dialog capturing OR room, surgeon, duration, and notes; detail dialogs for patient records and scheduled cases; schedule export included in baseline.\n\nUser Interface: The main screen is a split dashboard with waiting list on the left and schedule on the right. Clicking a card reveals a dialog with the patient’s full details, including optional notes and contact information. Clicking a calendar block reveals a scheduling dialog with fields for surgeon, OR room, and duration. Navigation is simple: a landing page leads straight to the dashboard, while the import wizard and settings are accessible from the top bar. The interface emphasizes readability with strong category colors and high‑contrast elements, and supports keyboard alternatives for drag actions."

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## Clarifications

### Session 2025-10-02
- Q: What concurrency model should apply to scheduling edits across users? → A: Multi-user, optimistic concurrency
- Q: Which data should be included in exports (PDF/Excel) by default? → A: Standard (name/MRN masked, case type, procedure, room, start–end, surgeon)
- Q: What’s the deduplication key for Excel imports to ensure idempotency? → A: Name and MRN
- Q: Which accessibility standard should we target for contrast and interactions? → A: Local team standard only (no WCAG guarantee)
- Q: Can Kanban column moves change the case category? → A: Yes, anyone can change via Kanban

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As an OR scheduler, I need a Kanban‑style waiting list beside a weekly or monthly OR calendar, with consistent color coding across both views, so I can triage and schedule cases quickly via drag‑and‑drop or a confirm dialog while keeping details a click away.

### Acceptance Scenarios
1. Given a backlog of unscheduled cases grouped by case type, when the scheduler selects a case and schedules it into an available OR time slot, then the case appears on the calendar in the correct room and time with the appropriate color code for its case type and is removed from the backlog list.
2. Given a scheduled OR calendar, when the scheduler clicks (or equivalent minimal interaction) on a case in either the backlog or the calendar, then a details panel shows the full case information without navigating away from the split view.
3. Given an OR slot conflict (e.g., overlapping time, room unavailable, surgeon double‑booked), when the scheduler attempts to schedule a case into that slot, then the system prevents the placement and shows clear guidance on what constraint is violated.
4. Given many cases in the backlog, when the scheduler filters by case type and/or searches by patient identifier or surgeon, then the backlog list updates and the split view remains visible.
5. Given a change in plans, when the scheduler reschedules or cancels a case from the calendar, then the calendar updates accordingly and the case is returned to the backlog (if applicable) with its previous triage information retained.
6. Given established color rules, when the scheduler views the Kanban board and the calendar, then the color mapping is consistent and a legend is visible across both views.
7. Excel import success: Given an Excel (.xlsx) file containing waiting list data with expected columns, when the coordinator imports the file and completes the mapping wizard, then patient/case records are created or updated, auto‑categorized (Minor, Biopsy, Pathology, Orthognathic), and backlog cards appear ordered by date of entry.
8. Excel import validation: Given a file with missing/ambiguous columns, when the coordinator attempts to import, then the system flags the issue in the mapping wizard, requests fixes, and prevents partial/incorrect ingestion until resolved.
9. Drag‑to‑schedule: Given backlog cards with name and MRN, when the scheduler drags a card onto a specific calendar day/slot, then a scheduling dialog opens prefilled as applicable; upon confirmation of OR room, surgeon, duration, and notes, the card is removed and a colored block appears on the calendar.
10. Checkbox‑to‑schedule: Given a backlog card, when the scheduler uses a confirm‑box/checkbox action, then a scheduling dialog opens to capture OR room, surgeon, duration, and notes; upon confirmation, the result matches drag‑to‑schedule behavior.
11. Click‑to‑edit: Given a scheduled calendar block, when the scheduler clicks it, then a details dialog opens for review/editing; upon save, changes reflect on the calendar.
12. Export: Given a day or week in view, when the coordinator exports to PDF or Excel, then the document includes the current schedule with color legend and the Standard field set (patient name with MRN masked, case type, procedure, room, start–end, surgeon), suitable for circulation, minimizing PHI.
13. View switch: Given content on a weekly calendar, when the scheduler switches to monthly view (or back), then the same cases remain visible with consistent color mapping and the current day/week context is preserved.
14. Kanban category move: Given a case in a Kanban column, when the scheduler moves it to a different category column, then the case’s category is updated immediately (no approval required) and the change is audit‑logged; this action is permitted for all users.
15. Keyboard alternative: Given a user who cannot use drag‑and‑drop, when they invoke a keyboard alternative (e.g., select card, choose slot, confirm), then scheduling completes successfully with the same validations and outcomes.
16. Navigation: Given the landing page, when a user selects “Go to Dashboard,” then the split dashboard opens; import wizard and settings are accessible from the top bar and return to the dashboard upon completion.

### Edge Cases
- No available OR capacity on the desired day: system proposes nearest alternative days/rooms or clearly indicates no availability. [NEEDS CLARIFICATION: should system suggest alternatives automatically?]
- Case data incomplete (e.g., missing estimated duration or required equipment): system blocks scheduling and indicates missing fields needed to proceed.
- Emergency add‑on cases arriving mid‑day: ability to insert into calendar while highlighting downstream impacts. [NEEDS CLARIFICATION: policies for bumping elective cases?]
- Time zone/clock changes (DST): ensure schedule integrity across transitions. [NEEDS CLARIFICATION: which time zone governs?]
- Concurrent edits by multiple schedulers: use optimistic concurrency—detect conflicts on save, inform the user, and offer retry/refresh to resolve; prevent silent overwrites.
- Cancellations close to surgery time: ensure notifications/policy compliance are captured. [NEEDS CLARIFICATION: notification and audit requirements?]
- Duplicate imports or re‑imports: ensure idempotency using Name+MRN as the dedup key; update existing records rather than creating duplicates; surface a summary of updated vs created vs skipped.
- Column variations/locales: handle column name differences, date/time formats, and number formats. [NEEDS CLARIFICATION: required vs optional columns and locale defaults]
- Export of empty schedule: generate a clear, header‑only document without errors.
- Large import files: provide limits and feedback. [NEEDS CLARIFICATION: maximum file size/row count]
- Accessibility and contrast: ensure category colors and non‑color indicators meet the Local Team Accessibility Standard.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: The system MUST provide a split‑view layout with the backlog on the left and an OR calendar on the right, both visible simultaneously.
- **FR-002**: The backlog MUST be grouped by case type and allow sorting and filtering (e.g., by case type, urgency, surgeon, facility/location).
- **FR-003**: The OR calendar MUST display rooms and time slots, and use color coding to visually distinguish case types (and optionally status) with an on‑screen legend.
- **FR-004**: The scheduler MUST be able to initiate scheduling from the backlog and place the case into a valid OR slot (date, room, time) subject to constraints.
- **FR-005**: The system MUST validate scheduling constraints, including at minimum: estimated case duration fit, room availability, surgeon availability, and room capability (required equipment/discipline). It MUST block invalid placements and explain conflicts.
- **FR-006**: The system MUST support quick access to full case details from either panel with minimal interactions (e.g., single click or hover‑reveal), without leaving the split view.
- **FR-007**: The system MUST support rescheduling and cancellation of scheduled cases, updating the calendar and backlog accordingly while retaining triage metadata.
- **FR-008**: The system MUST prevent double‑booking of rooms and surgeons and warn on near‑adjacent or turnaround time constraints. [NEEDS CLARIFICATION: turnaround/buffer policy]
- **FR-009**: The system MUST provide search across backlog by patient identifier, case type, procedure, and surgeon.
- **FR-010**: The system MUST display daily capacity indicators per OR (e.g., total minutes scheduled vs available) for at‑a‑glance planning. [NEEDS CLARIFICATION: capacity definition and targets]
- **FR-011**: The system SHOULD allow triage annotations or status (e.g., ready to schedule, awaiting clearance, high priority) and retain them through scheduling.
- **FR-012**: The system MUST log scheduling actions (create, move, cancel) with timestamp and actor for auditability. [NEEDS CLARIFICATION: audit retention and access]
- **FR-013**: The system MUST support basic conflict resolution workflows (e.g., propose alternate slots, unassign, or waitlist). [NEEDS CLARIFICATION: auto‑suggest vs manual]
- **FR-014**: The system MUST keep the split view stable during interactions (no full‑page navigations) to preserve context.
- **FR-015**: The system MUST provide an accessible color experience (legend, sufficient contrast, non‑color indicators) in accordance with the Local Team Accessibility Standard.
- **FR-016**: The system MUST respect privacy constraints by limiting PHI exposure in list views vs details. [NEEDS CLARIFICATION: PHI policy and masking]
- **FR-017**: The system MUST support multi‑user optimistic concurrency for scheduling-related edits: detect conflicts on save, inform the user, and provide actions to retry, refresh, or merge where applicable; avoid hard locks.
- **FR-018**: The system MUST define allowed user roles and permissions for viewing and scheduling (e.g., scheduler, surgeon, charge nurse, admin). [NEEDS CLARIFICATION: role model]
- **FR-019**: The system MUST define the data source of truth for patients, surgeons, procedures, and case requests. [NEEDS CLARIFICATION: integrations/feeds]
- **FR-020**: The system SHOULD provide unobtrusive guidance for minimal clicks (e.g., keyboard shortcuts or quick actions) without prescribing implementation. [NEEDS CLARIFICATION: specific minimum‑click targets]
- **FR-021**: The system MUST import waiting list data from Excel (.xlsx) and include a mapping wizard to map spreadsheet columns to patient/case fields; required columns MUST be validated before ingest.
- **FR-022**: The system MUST automatically assign each imported case to a case category (Minor, Biopsy, Pathology, Orthognathic) based on provided data. If classification is not possible, the case MUST be flagged for manual categorization. [NEEDS CLARIFICATION: classification rules and override behavior]
- **FR-023**: Backlog cards MUST display only name and MRN, and MUST be ordered by date of entry by default; additional sort options MAY be provided.
- **FR-024**: The system MUST support drag‑and‑drop of backlog cards onto a specific calendar day/slot; drop MUST invoke a scheduling dialog to confirm placement.
- **FR-025**: The system MUST support an alternative scheduling path via card confirm‑box/checkbox that opens the scheduling dialog for placement.
- **FR-026**: Upon scheduling, the backlog card MUST be removed and a colored calendar block MUST appear; clicking the block MUST reopen full details for review/editing.
- **FR-027**: The system MUST enable exporting the current day or week schedule to PDF and Excel, including a color legend and the Standard field set (patient name with MRN masked, case type, procedure, room, start–end, surgeon); PHI MUST be minimized. 
- **FR-028**: The system MUST ensure import idempotency and duplicate detection using Name+MRN as the deduplication key; on duplicates, the system MUST update existing records rather than create new ones and provide a clear import summary.
- **FR-029**: The system SHOULD allow saving/loading column mapping profiles per site or coordinator to streamline repeated imports. [NEEDS CLARIFICATION: profile scope and governance]
- **FR-030**: The system MUST provide clear error messages and remediation guidance for import failures (unsupported file, missing columns, invalid values) without partial data corruption.
- **FR-031**: The scheduling dialog MUST capture OR room, surgeon, duration, and notes prior to confirming placement.
- **FR-032**: The waiting list MUST be presented as a Kanban board with columns representing case categories; moving a card between columns MUST update the case category immediately with no approval required, and the change MUST be audit‑logged. This action is permitted for all users.
- **FR-033**: The calendar MUST support weekly and monthly views; switching views MUST preserve context and maintain consistent color mapping with the Kanban board.
- **FR-034**: Color coding MUST be consistent between Kanban cards and calendar blocks, and a legend MUST be available in both views.
- **FR-035**: The system MUST provide detail dialogs for both patient records (from backlog cards) and scheduled cases (from calendar blocks) to review/edit information, subject to permissions and audit logging.
- **FR-036**: The system MUST provide keyboard alternatives to drag‑and‑drop for all scheduling interactions, including selecting a card, choosing a slot, and confirming placement, with visible focus states and shortcuts. [NEEDS CLARIFICATION: specific shortcut scheme]
- **FR-037**: Navigation MUST be simple: a landing page leads directly to the dashboard; import wizard and settings MUST be accessible from a persistent top bar and return to the dashboard on completion.
- **FR-038**: The UI MUST use high‑contrast elements and strong category colors to support readability; non‑color indicators MUST be provided to convey status, in accordance with the Local Team Accessibility Standard.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed

---
