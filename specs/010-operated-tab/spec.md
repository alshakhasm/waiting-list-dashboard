# Feature Specification: Operated Cases Table

**Feature Branch**: `010-operated-tab`
**Created**: 2025-10-03  
**Status**: Draft  
**Input**: "Add operated tab. It opens a full screen table of operated cases with details. Remove Start/End columns."

## User Scenarios & Testing (mandatory)

### Primary User Story
As a clinician or scheduler, I want a full-screen table of operated (confirmed) cases so that I can review recent operations with key details and filter by date range.

### Acceptance Scenarios
1. Given I open the Operated tab, when the page loads, then I see a full-width table listing confirmed cases with columns: Date, Duration, Patient, Procedure, Surgeon, Room.
2. Given the Operated tab header controls, when I select a From and To date, then the table filters to entries whose dates fall within the selected period.
3. Given no entries match my date range, when the table renders, then I see an empty state row indicating there are no operated cases in the selected period.
4. Given the app theme (Default, Warm, High-Contrast, Dark, Auto), when I view the table, then borders, backgrounds, and text honor the theme tokens for contrast and readability.

### Edge Cases
- If many rows exist, the table must support horizontal/vertical scrolling without layout shift.
- If procedure text is very long, it should truncate with an ellipsis while keeping the row height reasonable.
- If fields are missing (e.g., missing patient name), a placeholder (e.g., "—") is displayed.

## Requirements (mandatory)

### Functional Requirements
- FR-001: The system MUST provide a dedicated "Operated" view with a full-width table layout.
- FR-002: The system MUST list only schedule entries with status = confirmed.
- FR-003: The system MUST provide a date range filter (From, To) that filters the table rows.
- FR-004: The system MUST include the following columns: Date, Duration (minutes), Patient, Procedure, Surgeon, Room. Start/End times MUST NOT be displayed in this table.
- FR-005: The system MUST persist the selected date range during the current session. [Optional]
- FR-006: The system SHOULD sort rows ascending by Date (then by internal order if needed).
- FR-007: The system MUST apply theme tokens for surfaces, borders, and text to the table.

### Key Entities
- OperatedCaseRow (derived): id, date, durationMin, patientName, procedure, surgeonId, roomId, status.
- ScheduleEntry (existing): used as the source of truth; only entries with status = confirmed are included.

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified
