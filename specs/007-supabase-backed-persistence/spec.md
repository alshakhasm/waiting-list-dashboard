# Feature Specification: Supabase-backed Persistence and Roles

**Feature Branch**: `007-supabase-backed-persistence`  
**Created**: 2025-10-02  
**Status**: Draft  
**Input**: User description: "Supabase-backed persistence and roles: staff add-only, seniors edit. UI uses Supabase when env present; fallback to in-process adapter for local dev."

## User Scenarios & Testing (mandatory)

### Primary User Story
As a team using the OR dashboard, we want our data to persist and access to be role-based so that staff can add (create) items but not modify existing ones, and seniors can edit (update/delete) entries. The UI should automatically use the cloud database when configured and otherwise work locally for development.

### Acceptance Scenarios
1. Given valid Supabase credentials are configured, When a staff user creates a schedule entry, Then the entry is saved in the cloud and visible to all users.
2. Given valid Supabase credentials are configured, When a staff user attempts to update or delete any schedule entry, Then the action is rejected.
3. Given valid Supabase credentials are configured, When a senior user updates or deletes a schedule entry, Then the change is saved and visible to all users.
4. Given no Supabase credentials are configured, When a user uses the app, Then the app runs with local in-memory behavior identical to before (non-persistent).
5. Given a user is unauthenticated, When they try to access protected operations, Then they are prevented and informed they need to sign in.

### Edge Cases
- Intermittent connectivity: operations should fail gracefully; user is informed without corrupting state.
- Conflicting edits: seniors receive clear conflict feedback (optimistic concurrency remains in effect where applicable).
- Role changes mid-session: after refresh, new role takes effect for authorization decisions.
- Rate limits/quotas on the free tier: the system provides a clear error and suggests retry later.

## Requirements (mandatory)

### Functional Requirements
- FR-001: System MUST persist backlog and schedule to a hosted data store when cloud configuration is present.
- FR-002: System MUST allow “staff” role to create (add) schedule entries but NOT update or delete them.
- FR-003: System MUST allow “senior” role to create, update, and delete schedule entries.
- FR-004: System MUST allow all authenticated users to read backlog and schedule.
- FR-005: System MUST provide a local fallback mode without credentials that uses in-memory data for development/demo.
- FR-006: The UI MUST adapt based on role (hide/disable edit controls for staff; expose for seniors) while server-side authorization still enforces rules.
- FR-007: System MUST present clear error messages when an operation is denied due to role restrictions.
- FR-008: Sign-in/out MUST be available to obtain a user identity and role for authorization.
- FR-009: System MUST not require any backend server management by the user (managed service only).

### Key Entities
- User: identity with a role attribute (staff | senior) used for authorization decisions.
- Backlog Item: patientName, maskedMrn, procedure, estDurationMin, surgeonId?, caseTypeId.
- Schedule Entry: waitingListItemId, date, startTime, endTime, roomId, surgeonId, status (tentative | confirmed), notes.

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none critical)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

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

## User Scenarios & Testing *(mandatory)*

### Primary User Story
[Describe the main user journey in plain language]

### Acceptance Scenarios
1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

### Edge Cases
- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*
- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*
- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

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
