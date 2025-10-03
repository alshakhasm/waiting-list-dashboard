# Feature Specification: Drag-and-drop from Dashboard to Calendar with Confirmation

**Feature Branch**: `005-drag-and-drop`  
**Created**: 2025-10-02  
**Status**: Draft  
**Input**: User description: "Drag and drop from dashboard to calendar; do not remove from dashboard until a confirmation checkbox is ticked near the patient."

## User Scenarios & Testing (mandatory)

### Primary User Story
As a scheduler, I want to drag a patient case from the Dashboard backlog and drop it onto a time slot in the Calendar to create a tentative schedule entry. The case should remain visible on the Dashboard until I explicitly confirm it via a checkbox next to that patient, so I can review and avoid accidental removals.

### Acceptance Scenarios
1. Given a backlog case on the Dashboard, When I drag the case and drop it on a specific day/time on the Calendar, Then a tentative schedule entry is created for that day/time and the case still appears in the Dashboard with an “Awaiting confirmation” state.
2. Given a case with a tentative schedule entry, When I tick the confirmation checkbox next to that patient on the Dashboard, Then the case is removed from the Dashboard and the schedule entry is marked as confirmed.
3. Given I drop a case on an invalid slot (e.g., outside configured hours), When I release the drag, Then the system rejects the drop and the case remains unchanged on the Dashboard.
4. Given overlapping or conflicting tentative entries, When I drop a case on an occupied slot, Then I receive a clear indication of conflict and no entry is created unless I choose another slot.
5. Given network or service errors during creation, When I drop a case onto the Calendar, Then an error message is shown and the case state remains unchanged.

### Edge Cases
- Drag canceled mid-way (escape or leave calendar area): no changes occur.
- Multiple tentative drops for the same case: [NEEDS CLARIFICATION: allow multiple tentative holds per case, or limit to one tentative per case?]
- Confirmation checkbox unticked after being ticked: [NEEDS CLARIFICATION: can users “unconfirm” and return the case to Dashboard?]
- Case already confirmed but user drags again: [NEEDS CLARIFICATION: should confirmed cases be draggable?]
- Time zone differences or DST transitions on selected week/day.

## Requirements (mandatory)

### Functional Requirements
- FR-001: Users MUST be able to drag a case from the Dashboard backlog and drop it onto a Calendar time slot to create a tentative schedule entry.
- FR-002: The case MUST remain visible on the Dashboard after drop, with a clear “Awaiting confirmation” indicator and a confirmation checkbox next to it.
- FR-003: Users MUST be able to confirm the scheduled case by ticking the checkbox; upon confirmation, the case is removed from the Dashboard and the entry is marked as confirmed.
- FR-004: The system MUST prevent drops on invalid slots (outside working hours or disabled periods) and show a non-blocking message.
- FR-005: The system MUST detect and prevent conflicts (room/time overlap or surgeon/time overlap as defined by scheduling rules) when creating tentative entries.
- FR-006: On errors during tentative creation or confirmation, the system MUST show an error and leave the Dashboard state unchanged.
- FR-007: The Calendar MUST show tentative entries visually distinct from confirmed ones.
- FR-008: Drag handles and drop targets MUST be accessible (keyboard operable alternative and ARIA attributes) [NEEDS CLARIFICATION: accessibility acceptance specifics].
- FR-009: The Dashboard search and grouping MUST continue to function while cases are in “Awaiting confirmation” state.
- FR-010: Users MUST be able to cancel a tentative entry (e.g., via a context action), returning the case to a normal backlog state without removal.

### Key Entities
- Backlog Case: patientName, maskedMrn, procedure, estDurationMin, surgeonId?, caseTypeId, status (normal | awaiting_confirmation | removed_on_confirm).
- Schedule Entry: id, waitingListItemId, date, startTime, endTime, roomId, surgeonId, status (tentative | confirmed), notes.
- Calendar Slot: day (ISO date), startTime, endTime, availability state (open | occupied | invalid-window).

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
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
- [x] Review checklist passed (with clarifications marked)
