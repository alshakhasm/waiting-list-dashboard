# Feature Specification: Main Dashboard Columns by Procedure Groups

**Feature Branch**: `003-main-dashboard-columns`  
**Created**: 2025-10-02  
**Status**: Draft  
**Input**: User description: "Main dashboard columns organized by procedure groups: Dental extraction, Minor pathology, Major pathology, Orthognathic, etc. Implement spec and UI structure for grouping and display."

## User Scenarios & Testing (mandatory)

### Primary User Story
As an OR scheduler, I want the main dashboard to display waiting list patients grouped into procedure columns (e.g., Dental extraction, Minor pathology, Major pathology, Orthognathic) so that I can quickly triage and pull candidates by category.

### Acceptance Scenarios
1. Given a backlog containing patients tagged with procedure groups, When I open the main dashboard, Then I see separate columns for each configured group with patients displayed in the appropriate column.
2. Given patients without an assigned group, When I view the dashboard, Then they appear under an "Uncategorized" column.
3. Given a name/procedure search query, When I type into the search box, Then only matching patients remain visible within their current columns and per-column counts update.
4. Given I toggle theme, When I switch between default and high-contrast, Then column headers and cards reflect appropriate contrast and legend colors remain consistent.

### Edge Cases
- If a configured group has no patients, the column still appears with a zero count (toggle to hide empty columns [NEEDS CLARIFICATION]).
- If many groups are configured, columns should horizontally scroll and preserve order.
- Duplicates from imports must be deduplicated before display (covered by import feature; dashboard consumes deduped backlog).

## Requirements (mandatory)

### Functional Requirements
- FR-001: System MUST support a configurable set of procedure group columns on the main dashboard. Initial default set: Dental extraction, Minor pathology, Major pathology, Orthognathic, Uncategorized.
- FR-002: System MUST map each backlog item to a single procedure group using existing attributes (e.g., `caseTypeId` or `procedure` text mapping).
- FR-003: System MUST display each group as a column with a header, count badge, and a vertically ordered list of patient cards.
- FR-004: System MUST support a global search box (name and/or procedure) that filters visible items across all columns.
- FR-005: System MUST maintain legend consistency with existing design tokens; column header accents align with legend.
- FR-006: System SHOULD persist the last used search query and chosen theme between sessions [NEEDS CLARIFICATION: persistence scope and mechanism].
- FR-007: System SHOULD allow hiding empty columns via a toggle [NEEDS CLARIFICATION].
- FR-008: System SHOULD allow re-ordering columns and saving the order [NEEDS CLARIFICATION].

### Key Entities
- ProcedureGroup (concept): name, displayLabel, colorKey/legendKey, order.
- BacklogItem (existing): patientName, maskedMrn, procedure, estDurationMin, caseTypeId, surgeonId? (no change in display requirement for surgeon on dashboard columns).

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous where specified
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed
